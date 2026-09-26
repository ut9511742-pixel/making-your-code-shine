ALTER TABLE public.profiles ALTER COLUMN blood_group DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN blood_group DROP DEFAULT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_blood_group_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_blood_group_check CHECK (blood_group IS NULL OR blood_group IN ('O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'));
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, blood_group, city, area)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Member'),
    NULLIF(NEW.raw_user_meta_data ->> 'blood_group', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'city', ''), 'Indore'),
    COALESCE(NEW.raw_user_meta_data ->> 'area', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;