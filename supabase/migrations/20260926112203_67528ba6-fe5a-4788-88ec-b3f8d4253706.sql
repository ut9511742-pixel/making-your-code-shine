DROP POLICY IF EXISTS "Authenticated members can browse donor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Members can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Members can edit their own profile" ON public.profiles;
CREATE POLICY "Members can read their own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Members can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can edit their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION bloodconnect_private.search_donors(
  search_blood_group TEXT,
  search_city TEXT,
  search_radius_km INTEGER,
  search_latitude DOUBLE PRECISION,
  search_longitude DOUBLE PRECISION
)
RETURNS TABLE (donor_initials TEXT, blood_group TEXT, area TEXT, city TEXT, distance_km DOUBLE PRECISION, days_since_donation INTEGER, available BOOLEAN)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
  SELECT
    COALESCE(upper(left(trim(p.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(p.full_name), ' ', 2), ''), 1)), ''), 'D') AS donor_initials,
    p.blood_group,
    p.area,
    p.city,
    round((6371 * 2 * asin(sqrt(
      power(sin(radians(p.latitude - search_latitude) / 2), 2) +
      cos(radians(search_latitude)) * cos(radians(p.latitude)) *
      power(sin(radians(p.longitude - search_longitude) / 2), 2)
    )))::numeric, 1)::double precision AS distance_km,
    CASE WHEN p.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - p.last_donation_date)::integer END AS days_since_donation,
    p.available
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id <> auth.uid()
    AND p.blood_group IS NOT NULL
    AND p.city = search_city
    AND p.available = true
    AND public.blood_group_compatible(p.blood_group, search_blood_group)
    AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)
    AND 6371 * 2 * asin(sqrt(
      power(sin(radians(p.latitude - search_latitude) / 2), 2) +
      cos(radians(search_latitude)) * cos(radians(p.latitude)) *
      power(sin(radians(p.longitude - search_longitude) / 2), 2)
    )) <= search_radius_km
  ORDER BY distance_km ASC
$$;
REVOKE ALL ON FUNCTION bloodconnect_private.search_donors(TEXT, TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bloodconnect_private.search_donors(TEXT, TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.search_donors(
  search_blood_group TEXT,
  search_city TEXT,
  search_radius_km INTEGER,
  search_latitude DOUBLE PRECISION,
  search_longitude DOUBLE PRECISION
)
RETURNS TABLE (donor_initials TEXT, blood_group TEXT, area TEXT, city TEXT, distance_km DOUBLE PRECISION, days_since_donation INTEGER, available BOOLEAN)
LANGUAGE SQL STABLE SET search_path = public, bloodconnect_private AS $$
  SELECT * FROM bloodconnect_private.search_donors(search_blood_group, search_city, search_radius_km, search_latitude, search_longitude)
$$;
REVOKE ALL ON FUNCTION public.search_donors(TEXT, TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_donors(TEXT, TEXT, INTEGER, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;