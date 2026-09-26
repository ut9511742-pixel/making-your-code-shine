CREATE SCHEMA IF NOT EXISTS bloodconnect_private;
REVOKE ALL ON SCHEMA bloodconnect_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA bloodconnect_private TO authenticated, service_role;

DROP POLICY IF EXISTS "Requesters and eligible nearby donors can view requests" ON public.blood_requests;
DROP POLICY IF EXISTS "Eligible donors can respond to requests" ON public.request_responses;

CREATE OR REPLACE FUNCTION bloodconnect_private.is_eligible_for_request(target_request_id UUID, candidate_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
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
REVOKE ALL ON FUNCTION bloodconnect_private.is_eligible_for_request(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION bloodconnect_private.is_eligible_for_request(UUID, UUID) TO authenticated, service_role;

CREATE POLICY "Requesters and eligible nearby donors can view requests" ON public.blood_requests FOR SELECT TO authenticated USING (requester_id = auth.uid() OR bloodconnect_private.is_eligible_for_request(id, auth.uid()));
CREATE POLICY "Eligible donors can respond to requests" ON public.request_responses FOR INSERT TO authenticated WITH CHECK (donor_id = auth.uid() AND bloodconnect_private.is_eligible_for_request(request_id, auth.uid()));

DROP FUNCTION IF EXISTS public.is_eligible_for_request(UUID, UUID);
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role;