CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY,
  full_name TEXT NOT NULL DEFAULT '' CHECK (char_length(full_name) BETWEEN 1 AND 100),
  blood_group TEXT NOT NULL DEFAULT 'O+' CHECK (blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  city TEXT NOT NULL DEFAULT 'Indore' CHECK (char_length(city) BETWEEN 1 AND 80),
  area TEXT NOT NULL DEFAULT '' CHECK (char_length(area) <= 120),
  latitude DOUBLE PRECISION NOT NULL DEFAULT 22.7196 CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL DEFAULT 75.8577 CHECK (longitude BETWEEN -180 AND 180),
  available BOOLEAN NOT NULL DEFAULT true,
  last_donation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated members can browse donor profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can edit their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL,
  blood_group TEXT NOT NULL CHECK (blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  units INTEGER NOT NULL CHECK (units BETWEEN 1 AND 20),
  hospital TEXT NOT NULL CHECK (char_length(hospital) BETWEEN 2 AND 160),
  city TEXT NOT NULL DEFAULT 'Indore' CHECK (char_length(city) BETWEEN 1 AND 80),
  area TEXT NOT NULL DEFAULT '' CHECK (char_length(area) <= 120),
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  radius_km INTEGER NOT NULL DEFAULT 10 CHECK (radius_km IN (5, 10, 20, 50)),
  urgency TEXT NOT NULL DEFAULT 'urgent' CHECK (urgency IN ('standard', 'urgent', 'critical')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'fulfilled', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.blood_requests TO authenticated;
GRANT ALL ON public.blood_requests TO service_role;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.request_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL,
  response TEXT NOT NULL DEFAULT 'accepted' CHECK (response IN ('accepted', 'declined')),
  message TEXT NOT NULL DEFAULT '' CHECK (char_length(message) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);
GRANT SELECT, INSERT, UPDATE ON public.request_responses TO authenticated;
GRANT ALL ON public.request_responses TO service_role;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.blood_group_compatible(donor_group TEXT, recipient_group TEXT)
RETURNS BOOLEAN LANGUAGE SQL IMMUTABLE SET search_path = public AS $$
  SELECT CASE donor_group
    WHEN 'O-' THEN true
    WHEN 'O+' THEN recipient_group IN ('O+', 'A+', 'B+', 'AB+')
    WHEN 'A-' THEN recipient_group IN ('A-', 'A+', 'AB-', 'AB+')
    WHEN 'A+' THEN recipient_group IN ('A+', 'AB+')
    WHEN 'B-' THEN recipient_group IN ('B-', 'B+', 'AB-', 'AB+')
    WHEN 'B+' THEN recipient_group IN ('B+', 'AB+')
    WHEN 'AB-' THEN recipient_group IN ('AB-', 'AB+')
    WHEN 'AB+' THEN recipient_group = 'AB+'
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.is_eligible_for_request(target_request_id UUID, candidate_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.blood_requests r
    JOIN public.profiles p ON p.user_id = candidate_user_id
    WHERE r.id = target_request_id
      AND r.status = 'open'
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
REVOKE ALL ON FUNCTION public.is_eligible_for_request(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_eligible_for_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_eligible_for_request(UUID, UUID) TO service_role;

CREATE POLICY "Requesters and eligible nearby donors can view requests" ON public.blood_requests FOR SELECT TO authenticated USING (requester_id = auth.uid() OR public.is_eligible_for_request(id));
CREATE POLICY "Members can create their own requests" ON public.blood_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Requesters can update their own requests" ON public.blood_requests FOR UPDATE TO authenticated USING (requester_id = auth.uid()) WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Donors and request owners can view responses" ON public.request_responses FOR SELECT TO authenticated USING (donor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND r.requester_id = auth.uid()));
CREATE POLICY "Eligible donors can respond to requests" ON public.request_responses FOR INSERT TO authenticated WITH CHECK (donor_id = auth.uid() AND public.is_eligible_for_request(request_id));
CREATE POLICY "Donors can update their own responses" ON public.request_responses FOR UPDATE TO authenticated USING (donor_id = auth.uid()) WITH CHECK (donor_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER blood_requests_touch_updated_at BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER request_responses_touch_updated_at BEFORE UPDATE ON public.request_responses FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Member'))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created_bloodconnect AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();