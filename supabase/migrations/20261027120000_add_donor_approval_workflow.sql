-- Donor approval workflow. Admins are provisioned by setting
-- auth.users.app_metadata.role = 'admin' through a trusted Supabase admin channel.
ALTER TABLE public.profiles
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'needs_information')),
  ADD COLUMN rejection_reason text,
  ADD COLUMN requested_information text,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_text_version text;

CREATE INDEX profiles_approval_status_created_idx
  ON public.profiles (approval_status, created_at DESC);
CREATE INDEX profiles_approved_availability_idx
  ON public.profiles (city, blood_group, available)
  WHERE approval_status = 'approved';

CREATE OR REPLACE FUNCTION public.is_bloodconnect_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS 'SELECT COALESCE(auth.jwt() -> ''app_metadata'' ->> ''role'' = ''admin'', false)';
REVOKE ALL ON FUNCTION public.is_bloodconnect_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_bloodconnect_admin() TO authenticated;

CREATE TABLE public.donor_approval_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donor_approval_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donor_approval_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.donor_approval_audit TO authenticated;
GRANT ALL ON public.donor_approval_audit TO service_role;
CREATE POLICY "Administrators can read donor approval audit"
  ON public.donor_approval_audit FOR SELECT TO authenticated
  USING (public.is_bloodconnect_admin());

CREATE TABLE public.donation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  donation_date date NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'donor_reported' CHECK (source = 'donor_reported'),
  UNIQUE (donor_id, donation_date)
);
ALTER TABLE public.donation_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.donation_history TO authenticated;
GRANT ALL ON public.donation_history TO service_role;
CREATE POLICY "Donors and administrators can read donation history"
  ON public.donation_history FOR SELECT TO authenticated
  USING (donor_id = auth.uid() OR public.is_bloodconnect_admin());
CREATE INDEX donation_history_donor_date_idx
  ON public.donation_history (donor_id, donation_date DESC);

INSERT INTO public.donation_history (donor_id, donation_date)
SELECT user_id, last_donation_date FROM public.profiles
WHERE last_donation_date IS NOT NULL
ON CONFLICT (donor_id, donation_date) DO NOTHING;

CREATE POLICY "Administrators can review donor profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_bloodconnect_admin());

CREATE OR REPLACE FUNCTION bloodconnect_private.guard_donor_profile_write()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  review_write boolean := COALESCE(current_setting('bloodconnect.review_donor', true), '') = 'on';
  donor_write boolean := false;
  identity_changed boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL AND auth.uid() = NEW.user_id THEN
      NEW.approval_status := 'pending';
      NEW.rejection_reason := NULL;
      NEW.requested_information := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
      IF NEW.consent_at IS NOT NULL THEN
        NEW.consent_at := statement_timestamp();
        NEW.consent_text_version := 'bloodconnect-donor-v1';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  donor_write := auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id;

  IF review_write AND (auth.uid() IS NULL OR NOT public.is_bloodconnect_admin()) THEN\n    RAISE EXCEPTION 'Administrator access required for approval fields' USING ERRCODE = '42501';\n  END IF;\n\n  IF NOT review_write AND (
    NEW.approval_status IS DISTINCT FROM OLD.approval_status OR
    NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
    NEW.requested_information IS DISTINCT FROM OLD.requested_information OR
    NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
    NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
  ) THEN
    RAISE EXCEPTION 'Donor approval fields can only be changed through the administrator review action';
  END IF;

  IF donor_write THEN
    IF NEW.consent_at IS DISTINCT FROM OLD.consent_at THEN
      IF NEW.consent_at IS NULL THEN
        NEW.consent_text_version := NULL;
      ELSE
        NEW.consent_at := statement_timestamp();
        NEW.consent_text_version := 'bloodconnect-donor-v1';
      END IF;
    END IF;

    identity_changed :=
      NEW.full_name IS DISTINCT FROM OLD.full_name OR
      NEW.blood_group IS DISTINCT FROM OLD.blood_group OR
      NEW.city IS DISTINCT FROM OLD.city OR
      NEW.area IS DISTINCT FROM OLD.area OR
      NEW.phone IS DISTINCT FROM OLD.phone;

    IF NEW.consent_at IS NULL AND OLD.approval_status = 'approved' THEN
      NEW.approval_status := 'pending';
      NEW.rejection_reason := NULL;
      NEW.requested_information := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    ELSIF identity_changed AND OLD.approval_status IN ('needs_information', 'approved') THEN
      NEW.approval_status := 'pending';
      NEW.rejection_reason := NULL;
      NEW.requested_information := NULL;
      NEW.reviewed_by := NULL;
      NEW.reviewed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloodconnect_private.guard_donor_profile_write() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_guard_donor_approval
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION bloodconnect_private.guard_donor_profile_write();

CREATE OR REPLACE FUNCTION public.audit_donor_approval_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status THEN
    INSERT INTO public.donor_approval_audit (donor_id, actor_id, from_status, to_status, reason)
    VALUES (
      NEW.user_id,
      COALESCE(auth.uid(), NEW.reviewed_by),
      OLD.approval_status,
      NEW.approval_status,
      COALESCE(NEW.rejection_reason, NEW.requested_information,
        CASE WHEN NEW.approval_status = 'pending' THEN 'Donor resubmitted profile information.' ELSE NULL END)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_donor_approval_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_audit_donor_approval
  AFTER UPDATE OF approval_status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_donor_approval_change();

CREATE OR REPLACE FUNCTION public.capture_donor_reported_donation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.last_donation_date IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.last_donation_date IS DISTINCT FROM OLD.last_donation_date) THEN
    INSERT INTO public.donation_history (donor_id, donation_date)
    VALUES (NEW.user_id, NEW.last_donation_date)
    ON CONFLICT (donor_id, donation_date) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.capture_donor_reported_donation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_capture_donation_history
  AFTER INSERT OR UPDATE OF last_donation_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.capture_donor_reported_donation();

CREATE OR REPLACE FUNCTION public.review_donor(
  target_donor_id uuid,
  decision text,
  decision_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE donor public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_bloodconnect_admin() THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;
  IF decision IS NULL OR decision NOT IN ('approved', 'rejected', 'needs_information') THEN
    RAISE EXCEPTION 'Unsupported donor review decision';
  END IF;
  IF decision = 'rejected' AND (decision_reason IS NULL OR char_length(btrim(decision_reason)) NOT BETWEEN 3 AND 1000) THEN
    RAISE EXCEPTION 'Enter a rejection reason between 3 and 1000 characters';
  END IF;
  IF decision = 'needs_information' AND (decision_reason IS NULL OR char_length(btrim(decision_reason)) NOT BETWEEN 3 AND 1000) THEN
    RAISE EXCEPTION 'Describe the information needed (3 to 1000 characters)';
  END IF;

  SELECT * INTO donor FROM public.profiles WHERE user_id = target_donor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donor record not found'; END IF;
  IF donor.approval_status = decision THEN RAISE EXCEPTION 'Donor already has this approval status'; END IF;

  IF decision = 'approved' AND (
    char_length(btrim(donor.full_name)) < 2 OR donor.blood_group IS NULL OR
    char_length(btrim(donor.city)) < 2 OR char_length(btrim(donor.area)) < 1 OR
    donor.phone !~ '^\+?[0-9 ()-]{7,20}$' OR donor.consent_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Complete the donor profile and record consent before approval';
  END IF;

  PERFORM set_config('bloodconnect.review_donor', 'on', true);
  UPDATE public.profiles
  SET approval_status = decision,
      rejection_reason = CASE WHEN decision = 'rejected' THEN btrim(decision_reason) ELSE NULL END,
      requested_information = CASE WHEN decision = 'needs_information' THEN btrim(decision_reason) ELSE NULL END,
      reviewed_by = auth.uid(),
      reviewed_at = statement_timestamp()
  WHERE user_id = target_donor_id;

  RETURN jsonb_build_object('donor_id', target_donor_id, 'status', decision);
END;
$$;
REVOKE ALL ON FUNCTION public.review_donor(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_donor(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_donor_reported_donation()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.last_donation_date IS NOT NULL AND
     (TG_OP = 'INSERT' OR NEW.last_donation_date IS DISTINCT FROM OLD.last_donation_date) THEN
    INSERT INTO public.donation_history (donor_id, donation_date)
    VALUES (NEW.user_id, NEW.last_donation_date)
    ON CONFLICT (donor_id, donation_date) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION bloodconnect_private.is_eligible_for_request(target_request_id uuid, candidate_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blood_requests r
    JOIN public.profiles p ON p.user_id = candidate_user_id
    WHERE r.id = target_request_id
      AND r.status = 'open'
      AND p.approval_status = 'approved'
      AND p.consent_at IS NOT NULL
      AND p.available = true
      AND p.city = r.city
      AND public.blood_group_compatible(p.blood_group, r.blood_group)
      AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)
      AND 6371 * 2 * asin(sqrt(
        power(sin(radians(p.latitude - r.latitude) / 2), 2) +
        cos(radians(r.latitude)) * cos(radians(p.latitude)) *
        power(sin(radians(p.longitude - r.longitude) / 2), 2)
      )) <= r.radius_km
  )
$$;

CREATE OR REPLACE FUNCTION bloodconnect_private.search_donors(
  search_blood_group text,
  search_city text,
  search_radius_km integer,
  search_latitude double precision,
  search_longitude double precision
)
RETURNS TABLE (donor_initials text, blood_group text, area text, city text, distance_km double precision, days_since_donation integer, available boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
  WITH candidates AS (
    SELECT
      COALESCE(upper(left(trim(p.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(p.full_name), ' ', 2), ''), 1)), ''), 'D') AS donor_initials,
      p.blood_group, p.area, p.city, p.latitude, p.longitude, p.last_donation_date, p.available
    FROM public.profiles p
    WHERE p.user_id <> auth.uid()
      AND p.approval_status = 'approved'
      AND p.consent_at IS NOT NULL
      AND p.blood_group IS NOT NULL
      AND p.city = search_city AND p.available = true
      AND public.blood_group_compatible(p.blood_group, search_blood_group)
      AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)
  ), distances AS (
    SELECT c.*, 6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - search_latitude) / 2), 2) +
      cos(radians(search_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - search_longitude) / 2), 2)
    )) AS raw_distance_km FROM candidates c
  )
  SELECT d.donor_initials, d.blood_group, d.area, d.city,
    round(d.raw_distance_km::numeric, 1)::double precision,
    CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
    d.available
  FROM distances d
  WHERE auth.uid() IS NOT NULL
    AND search_blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
    AND search_radius_km IN (5, 10, 20, 50)
    AND d.raw_distance_km <= search_radius_km
  ORDER BY d.raw_distance_km ASC
$$;

CREATE OR REPLACE FUNCTION public.search_donors_with_ids(
  search_blood_group text,
  search_city text,
  search_radius_km integer,
  search_latitude double precision,
  search_longitude double precision
)
RETURNS TABLE(donor_reference text, donor_initials text, blood_group text, area text, city text, distance_km double precision, days_since_donation integer, available boolean, eligible boolean, is_demo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH candidates AS (
    SELECT 'profile:' || p.user_id::text AS donor_reference,
      COALESCE(upper(left(trim(p.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(p.full_name), ' ', 2), ''), 1)), ''), 'D') AS donor_initials,
      p.blood_group, p.area, p.city, p.latitude, p.longitude, p.last_donation_date, p.available
    FROM public.profiles p
    WHERE p.user_id <> auth.uid()
      AND p.approval_status = 'approved'
      AND p.consent_at IS NOT NULL
      AND p.blood_group IS NOT NULL
      AND p.city = search_city
      AND p.available = true
      AND public.blood_group_compatible(p.blood_group, search_blood_group)
      AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)
  ), distances AS (
    SELECT c.*, 6371 * 2 * asin(sqrt(
      power(sin(radians(c.latitude - search_latitude) / 2), 2) +
      cos(radians(search_latitude)) * cos(radians(c.latitude)) *
      power(sin(radians(c.longitude - search_longitude) / 2), 2)
    )) AS raw_distance_km FROM candidates c
  )
  SELECT d.donor_reference, d.donor_initials, d.blood_group, d.area, d.city,
    round(d.raw_distance_km::numeric, 1)::double precision,
    CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
    d.available,
    (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90),
    false
  FROM distances d
  WHERE auth.uid() IS NOT NULL
    AND search_blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
    AND search_radius_km IN (5, 10, 20, 50)
    AND d.raw_distance_km <= search_radius_km
  ORDER BY d.raw_distance_km ASC
$$;

CREATE OR REPLACE FUNCTION public.get_donor_profile(donor_reference text, search_blood_group text, search_radius_km integer)
RETURNS TABLE(donor_initials text, blood_group text, area text, city text, distance_km double precision, days_since_donation integer, available boolean, eligible boolean, is_demo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE viewer public.profiles%ROWTYPE; target_uuid uuid;
BEGIN
  IF auth.uid() IS NULL OR search_blood_group NOT IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
    OR search_radius_km NOT IN (5, 10, 20, 50) OR donor_reference NOT LIKE 'profile:%'
    OR substring(donor_reference FROM 9) !~* '^[0-9a-f-]{36}$' THEN RETURN; END IF;
  SELECT p.* INTO viewer FROM public.profiles p WHERE p.user_id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;
  BEGIN target_uuid := substring(donor_reference FROM 9)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN; END;
  RETURN QUERY
  SELECT COALESCE(upper(left(trim(d.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(d.full_name), ' ', 2), ''), 1)), ''), 'D'),
    d.blood_group, d.area, d.city,
    round((6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))))::numeric, 1)::double precision,
    CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
    d.available,
    (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90),
    false
  FROM public.profiles d
  WHERE d.user_id = target_uuid AND d.user_id <> auth.uid()
    AND d.approval_status = 'approved'
    AND d.consent_at IS NOT NULL
    AND d.available AND d.blood_group IS NOT NULL AND d.city = viewer.city
    AND public.blood_group_compatible(d.blood_group, search_blood_group)
    AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
    AND 6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))) <= search_radius_km;
END;
$$;

CREATE OR REPLACE FUNCTION public.request_donor_location(target_donor_id uuid, target_blood_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requester uuid := auth.uid(); request_row public.blood_requests%ROWTYPE; donor public.profiles%ROWTYPE; result_id uuid;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Sign in to request donor location approval'; END IF;
  IF target_donor_id = requester THEN RAISE EXCEPTION 'You cannot request your own location'; END IF;
  SELECT * INTO request_row FROM public.blood_requests WHERE id = target_blood_request_id AND requester_id = requester AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose one of your own open blood requests'; END IF;
  SELECT * INTO donor FROM public.profiles WHERE user_id = target_donor_id AND approval_status = 'approved' AND consent_at IS NOT NULL AND available AND blood_group IS NOT NULL;
  IF NOT FOUND OR (donor.last_donation_date IS NOT NULL AND donor.last_donation_date > CURRENT_DATE - 90) THEN RAISE EXCEPTION 'This donor is no longer available'; END IF;
  IF donor.city <> request_row.city OR NOT public.blood_group_compatible(donor.blood_group, request_row.blood_group) THEN RAISE EXCEPTION 'This donor does not match the request'; END IF;
  IF 6371 * 2 * asin(sqrt(power(sin(radians(donor.latitude - request_row.latitude) / 2), 2) + cos(radians(request_row.latitude)) * cos(radians(donor.latitude)) * power(sin(radians(donor.longitude - request_row.longitude) / 2), 2))) > request_row.radius_km THEN RAISE EXCEPTION 'This donor is outside your request radius'; END IF;
  INSERT INTO public.location_requests(requester_id, donor_id, blood_request_id)
  VALUES (requester, donor.user_id, request_row.id) RETURNING id INTO result_id;
  RETURN result_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A pending or approved location request already exists for this blood request';
END;
$$;


CREATE OR REPLACE FUNCTION public.get_approved_donor_location(target_location_request_id uuid)
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT donor.latitude, donor.longitude
  FROM public.location_requests lr
  JOIN public.profiles donor ON donor.user_id = lr.donor_id
  WHERE auth.uid() IS NOT NULL
    AND lr.id = target_location_request_id
    AND lr.requester_id = auth.uid()
    AND lr.status = 'approved'
    AND donor.approval_status = 'approved'
    AND donor.consent_at IS NOT NULL
    AND donor.available
    AND (donor.last_donation_date IS NULL OR donor.last_donation_date <= CURRENT_DATE - 90)
$$;

CREATE OR REPLACE FUNCTION public.respond_to_location_request(target_location_request_id uuid, approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE next_status text := CASE WHEN approve THEN 'approved' ELSE 'rejected' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to respond'; END IF;
  IF approve AND NOT EXISTS (
    SELECT 1 FROM public.location_requests lr
    JOIN public.profiles donor ON donor.user_id = lr.donor_id
    WHERE lr.id = target_location_request_id
      AND lr.donor_id = auth.uid()
      AND lr.status = 'pending'
      AND donor.approval_status = 'approved'
      AND donor.consent_at IS NOT NULL
      AND donor.available
      AND donor.blood_group IS NOT NULL
      AND (donor.last_donation_date IS NULL OR donor.last_donation_date <= CURRENT_DATE - 90)
  ) THEN
    RAISE EXCEPTION 'Only approved, available donors who meet the existing donation interval can approve location sharing';
  END IF;
  UPDATE public.location_requests SET status = next_status, updated_at = now()
  WHERE id = target_location_request_id AND donor_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'This location request is no longer pending or does not belong to you'; END IF;
  RETURN next_status;
END;
$$;
