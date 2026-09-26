CREATE OR REPLACE FUNCTION bloodconnect_private.sync_request_response_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, bloodconnect_private AS $$
BEGIN
  IF NEW.response = 'accepted' THEN
    UPDATE public.blood_requests SET status = 'matched' WHERE id = NEW.request_id AND status = 'open';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION bloodconnect_private.sync_request_response_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bloodconnect_private.sync_request_response_status() TO service_role;
CREATE TRIGGER request_response_sync_status AFTER INSERT OR UPDATE OF response ON public.request_responses FOR EACH ROW EXECUTE FUNCTION bloodconnect_private.sync_request_response_status();