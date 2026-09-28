CREATE TABLE bloodconnect_private.demo_donors (
  donor_code text PRIMARY KEY,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 100),
  age integer NOT NULL CHECK (age BETWEEN 18 AND 65),
  gender text NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  blood_group text NOT NULL CHECK (blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-')),
  city text NOT NULL CHECK (char_length(city) BETWEEN 2 AND 80),
  area text NOT NULL CHECK (char_length(area) BETWEEN 1 AND 120),
  phone text NOT NULL CHECK (phone ~ '^[0-9]{10,15}$'),
  last_donation_date date,
  eligible boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT false,
  emergency_available boolean NOT NULL DEFAULT false,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON bloodconnect_private.demo_donors FROM PUBLIC, anon, authenticated;
GRANT ALL ON bloodconnect_private.demo_donors TO service_role;

CREATE TRIGGER demo_donors_touch_updated_at
BEFORE UPDATE ON bloodconnect_private.demo_donors
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION bloodconnect_private.search_donors(
  search_blood_group text,
  search_city text,
  search_radius_km integer,
  search_latitude double precision,
  search_longitude double precision
)
RETURNS TABLE(
  donor_initials text,
  blood_group text,
  area text,
  city text,
  distance_km double precision,
  days_since_donation integer,
  available boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, bloodconnect_private
AS $$
  WITH candidates AS (
    SELECT
      COALESCE(upper(left(trim(p.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(p.full_name), ' ', 2), ''), 1)), ''), 'D') AS donor_initials,
      p.blood_group,
      p.area,
      p.city,
      p.latitude,
      p.longitude,
      p.last_donation_date,
      p.available
    FROM public.profiles p
    WHERE p.user_id <> auth.uid()
      AND p.blood_group IS NOT NULL
      AND p.city = search_city
      AND p.available = true
      AND public.blood_group_compatible(p.blood_group, search_blood_group)
      AND (p.last_donation_date IS NULL OR p.last_donation_date <= CURRENT_DATE - 90)

    UNION ALL

    SELECT
      COALESCE(upper(left(trim(d.full_name), 1)) || COALESCE(upper(left(NULLIF(split_part(trim(d.full_name), ' ', 2), ''), 1)), ''), 'D') AS donor_initials,
      d.blood_group,
      d.area,
      d.city,
      d.latitude,
      d.longitude,
      d.last_donation_date,
      d.available
    FROM bloodconnect_private.demo_donors d
    WHERE d.city = search_city
      AND d.available = true
      AND d.eligible = true
      AND public.blood_group_compatible(d.blood_group, search_blood_group)
      AND (d.last_donation_date IS NULL OR d.last_donation_date <= CURRENT_DATE - 90)
  ), distances AS (
    SELECT
      c.*,
      6371 * 2 * asin(sqrt(
        power(sin(radians(c.latitude - search_latitude) / 2), 2) +
        cos(radians(search_latitude)) * cos(radians(c.latitude)) *
        power(sin(radians(c.longitude - search_longitude) / 2), 2)
      )) AS raw_distance_km
    FROM candidates c
  )
  SELECT
    d.donor_initials,
    d.blood_group,
    d.area,
    d.city,
    round(d.raw_distance_km::numeric, 1)::double precision,
    CASE WHEN d.last_donation_date IS NULL THEN NULL ELSE (CURRENT_DATE - d.last_donation_date)::integer END,
    d.available
  FROM distances d
  WHERE auth.uid() IS NOT NULL
    AND d.raw_distance_km <= search_radius_km
  ORDER BY d.raw_distance_km ASC
$$;

REVOKE ALL ON FUNCTION bloodconnect_private.search_donors(text, text, integer, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bloodconnect_private.search_donors(text, text, integer, double precision, double precision) TO authenticated, service_role;