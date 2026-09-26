ALTER TABLE public.profiles ADD COLUMN phone TEXT NOT NULL DEFAULT '' CHECK (phone = '' OR phone ~ '^\+?[0-9 ()-]{7,20}$');
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, blood_group, city, area, phone)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''), 'Member'),
    NULLIF(NEW.raw_user_meta_data ->> 'blood_group', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'city', ''), 'Indore'),
    COALESCE(NEW.raw_user_meta_data ->> 'area', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;

CREATE OR REPLACE FUNCTION bloodconnect_private.accepted_request_contacts(target_request_id UUID)
RETURNS TABLE (member_name TEXT, phone TEXT, member_role TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
  SELECT p.full_name, p.phone, CASE WHEN p.user_id = r.requester_id THEN 'requester' ELSE 'donor' END
  FROM public.blood_requests r
  JOIN public.request_responses rr ON rr.request_id = r.id AND rr.response = 'accepted'
  JOIN public.profiles p ON p.user_id IN (r.requester_id, rr.donor_id)
  WHERE r.id = target_request_id
    AND auth.uid() IS NOT NULL
    AND auth.uid() IN (r.requester_id, rr.donor_id)
    AND (auth.uid() = r.requester_id OR rr.donor_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION bloodconnect_private.accepted_request_contacts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloodconnect_private.accepted_request_contacts(UUID) TO service_role;
CREATE OR REPLACE FUNCTION public.accepted_request_contacts(target_request_id UUID)
RETURNS TABLE (member_name TEXT, phone TEXT, member_role TEXT)
LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = public, bloodconnect_private AS $$
  SELECT * FROM bloodconnect_private.accepted_request_contacts(target_request_id)
$$;
REVOKE ALL ON FUNCTION public.accepted_request_contacts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accepted_request_contacts(UUID) TO authenticated;