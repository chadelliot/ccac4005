CREATE POLICY "Assignee or admin delete follow-ups"
ON public.contact_follow_ups
FOR DELETE
TO authenticated
USING ((assigned_to = auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));