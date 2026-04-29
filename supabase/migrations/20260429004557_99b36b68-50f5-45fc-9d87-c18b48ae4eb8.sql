
-- Restrict EXECUTE on definer functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.schedule_initial_followups() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
-- has_role is intentionally callable by authenticated users (used in RLS), but restrict anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- Replace permissive insert policy on follow-ups
DROP POLICY IF EXISTS "System inserts follow-ups" ON public.contact_follow_ups;
CREATE POLICY "Owner inserts follow-ups" ON public.contact_follow_ups
  FOR INSERT TO authenticated
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));
