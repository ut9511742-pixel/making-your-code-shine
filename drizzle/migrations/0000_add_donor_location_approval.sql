CREATE TABLE public.location_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL,
  donor_id uuid NOT NULL REFERENCES public.profiles(user_id),
  blood_request_id uuid NOT NULL REFERENCES public.blood_requests(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT location_requests_not_self CHECK (requester_id <> donor_id)
);
GRANT SELECT ON public.location_requests TO authenticated;
GRANT ALL ON public.location_requests TO service_role;
ALTER TABLE public.location_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can read location requests" ON public.location_requests
  FOR SELECT TO authenticated USING (requester_id = auth.uid() OR donor_id = auth.uid());
CREATE INDEX location_requests_requester_idx ON public.location_requests (requester_id, created_at DESC);
CREATE INDEX location_requests_donor_idx ON public.location_requests (donor_id, created_at DESC);
CREATE UNIQUE INDEX location_requests_active_unique_idx ON public.location_requests (requester_id, donor_id, blood_request_id) WHERE status IN ('pending', 'approved');
CREATE TRIGGER location_requests_touch_updated_at BEFORE UPDATE ON public.location_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

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
      p.blood_group, p.area, p.city, p.latitude, p.longitude, p.last_donation_date, p.available, false AS is_demo
    FROM public.profiles p
    WHERE p.user_id <> auth.uid() AND p.blood_group IS NOT NULL AND p.city = search_city AND p.available
      AND public.blood_group_compatible(p.blood_group, search_blood_group)
      AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)
    UNION ALL
    SELECT 'demo:' || d.donor_code,
      COALESCE(upper(left(trim(d.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(d.full_name), ' ', 2), ''), 1)), ''), 'D'),
      d.blood_group, d.area, d.city, d.latitude, d.longitude, d.last_donation_date, d.available, true
    FROM bloodconnect_private.demo_donors d
    WHERE d.city = search_city AND d.available AND d.eligible
      AND public.blood_group_compatible(d.blood_group, search_blood_group)
      AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
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
    d.available, true, d.is_demo
  FROM distances d
  WHERE auth.uid() IS NOT NULL AND search_blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')
    AND search_radius_km IN (5, 10, 20, 50) AND d.raw_distance_km <= search_radius_km
  ORDER BY d.raw_distance_km ASC
$$;
REVOKE ALL ON FUNCTION public.search_donors_with_ids(text, text, integer, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_donors_with_ids(text, text, integer, double precision, double precision) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_donor_profile(donor_reference text, search_blood_group text, search_radius_km integer)
RETURNS TABLE(donor_initials text, blood_group text, area text, city text, distance_km double precision, days_since_donation integer, available boolean, eligible boolean, is_demo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  viewer public.profiles%ROWTYPE;
  target_uuid uuid;
  target_code text;
BEGIN
  IF auth.uid() IS NULL OR search_blood_group NOT IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-') OR search_radius_km NOT IN (5, 10, 20, 50) THEN RETURN; END IF;
  SELECT p.* INTO viewer FROM public.profiles p WHERE p.user_id = auth.uid();
  IF NOT FOUND THEN RETURN; END IF;
  IF donor_reference LIKE 'profile:%' AND substring(donor_reference FROM 9) ~* '^[0-9a-f-]{36}$' THEN
    BEGIN target_uuid := substring(donor_reference FROM 9)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN; END;
    RETURN QUERY
    SELECT COALESCE(upper(left(trim(d.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(d.full_name), ' ', 2), ''), 1)), ''), 'D'),
      d.blood_group, d.area, d.city,
      round((6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))))::numeric, 1)::double precision,
      CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
      d.available, (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90), false
    FROM public.profiles d
    WHERE d.user_id = target_uuid AND d.user_id <> auth.uid() AND d.available AND d.blood_group IS NOT NULL
      AND d.city = viewer.city AND public.blood_group_compatible(d.blood_group, search_blood_group)
      AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
      AND 6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))) <= search_radius_km;
  ELSIF donor_reference LIKE 'demo:%' THEN
    target_code := substring(donor_reference FROM 6);
    RETURN QUERY
    SELECT COALESCE(upper(left(trim(d.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(d.full_name), ' ', 2), ''), 1)), ''), 'D'),
      d.blood_group, d.area, d.city,
      round((6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))))::numeric, 1)::double precision,
      CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
      d.available, true, true
    FROM bloodconnect_private.demo_donors d
    WHERE d.donor_code = target_code AND d.available AND d.eligible AND d.city = viewer.city
      AND public.blood_group_compatible(d.blood_group, search_blood_group)
      AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
      AND 6371 * 2 * asin(sqrt(power(sin(radians(d.latitude - viewer.latitude) / 2), 2) + cos(radians(viewer.latitude)) * cos(radians(d.latitude)) * power(sin(radians(d.longitude - viewer.longitude) / 2), 2))) <= search_radius_km;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.get_donor_profile(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_donor_profile(text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.request_donor_location(target_donor_id uuid, target_blood_request_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE requester uuid := auth.uid(); request_row public.blood_requests%ROWTYPE; donor public.profiles%ROWTYPE; result_id uuid;
BEGIN
  IF requester IS NULL THEN RAISE EXCEPTION 'Sign in to request donor location approval'; END IF;
  IF target_donor_id = requester THEN RAISE EXCEPTION 'You cannot request your own location'; END IF;
  SELECT * INTO request_row FROM public.blood_requests WHERE id = target_blood_request_id AND requester_id = requester AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose one of your own open blood requests'; END IF;
  SELECT * INTO donor FROM public.profiles WHERE user_id = target_donor_id AND available AND blood_group IS NOT NULL;
  IF NOT FOUND OR (donor.last_donation_date IS NOT NULL AND donor.last_donation_date > CURRENT_DATE - 90) THEN RAISE EXCEPTION 'This donor is no longer available'; END IF;
  IF donor.city <> request_row.city OR NOT public.blood_group_compatible(donor.blood_group, request_row.blood_group) THEN RAISE EXCEPTION 'This donor does not match the request'; END IF;
  IF 6371 * 2 * asin(sqrt(power(sin(radians(donor.latitude - request_row.latitude) / 2), 2) + cos(radians(request_row.latitude)) * cos(radians(donor.latitude)) * power(sin(radians(donor.longitude - request_row.longitude) / 2), 2))) > request_row.radius_km THEN RAISE EXCEPTION 'This donor is outside your request radius'; END IF;
  INSERT INTO public.location_requests(requester_id, donor_id, blood_request_id)
  VALUES (requester, donor.user_id, request_row.id) RETURNING id INTO result_id;
  RETURN result_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'A pending or approved location request already exists for this blood request';
END;
$$;
REVOKE ALL ON FUNCTION public.request_donor_location(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_donor_location(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_my_location_requests()
RETURNS TABLE(location_request_id uuid, donor_reference text, blood_group text, area text, city text, status text, request_blood_group text, units integer, hospital text, urgency text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lr.id, 'profile:' || p.user_id::text, p.blood_group, p.area, p.city, lr.status,
    br.blood_group, br.units, br.hospital, br.urgency, lr.created_at
  FROM public.location_requests lr
  JOIN public.profiles p ON p.user_id = lr.donor_id
  JOIN public.blood_requests br ON br.id = lr.blood_request_id
  WHERE auth.uid() IS NOT NULL AND lr.requester_id = auth.uid()
  ORDER BY lr.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_my_location_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_location_requests() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_incoming_location_requests()
RETURNS TABLE(location_request_id uuid, requester_name text, requester_city text, requester_area text, request_blood_group text, units integer, hospital text, urgency text, note text, status text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT lr.id, p.full_name, p.city, p.area, br.blood_group, br.units, br.hospital, br.urgency, br.note, lr.status, lr.created_at
  FROM public.location_requests lr
  JOIN public.profiles p ON p.user_id = lr.requester_id
  JOIN public.blood_requests br ON br.id = lr.blood_request_id
  WHERE auth.uid() IS NOT NULL AND lr.donor_id = auth.uid()
  ORDER BY lr.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_incoming_location_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_incoming_location_requests() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_to_location_request(target_location_request_id uuid, approve boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE next_status text := CASE WHEN approve THEN 'approved' ELSE 'rejected' END;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to respond'; END IF;
  UPDATE public.location_requests SET status = next_status, updated_at = now()
  WHERE id = target_location_request_id AND donor_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'This location request is no longer pending or does not belong to you'; END IF;
  RETURN next_status;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_location_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_location_request(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_approved_donor_location(target_location_request_id uuid)
RETURNS TABLE(latitude double precision, longitude double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT donor.latitude, donor.longitude
  FROM public.location_requests lr
  JOIN public.profiles donor ON donor.user_id = lr.donor_id
  WHERE auth.uid() IS NOT NULL AND lr.id = target_location_request_id
    AND lr.requester_id = auth.uid() AND lr.status = 'approved'
$$;
REVOKE ALL ON FUNCTION public.get_approved_donor_location(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_approved_donor_location(uuid) TO authenticated, service_role;