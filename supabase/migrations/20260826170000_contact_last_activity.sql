-- ============================================================================
-- When was this soul last reached?
-- ============================================================================
-- The contact list shows when someone was witnessed to. What it could not show
-- is whether anything has happened since — so a name met in March and never
-- called again looks exactly like one called yesterday.
--
-- The answer is already in the activity timeline; this just surfaces the latest
-- entry per contact so the list can be read at a glance.
--
-- A note counts, and an edited note counts as of its edit: coming back to write
-- up how a conversation went is itself contact with that person. GREATEST over
-- created_at and updated_at is what makes a revised note move the date.
-- ============================================================================

CREATE VIEW public.contact_last_activity
WITH (security_invoker = true) AS
SELECT
  contact_id,
  max(GREATEST(created_at, coalesce(updated_at, created_at))) AS last_activity_at,
  count(*) AS activity_count
FROM public.contact_activity
GROUP BY contact_id;

-- security_invoker is the whole point of this view.
--
-- Without it the view would run as its owner and hand every caller the same
-- answer, including dates derived from admin-only notes — a member would learn
-- that something happened on the 14th without being allowed to know what. With
-- it, the policies on contact_activity are evaluated as the person asking, so
-- each viewer's "last contacted" is computed only from the entries they may
-- already read.
COMMENT ON VIEW public.contact_last_activity IS
  'Latest activity per contact. security_invoker: rows are filtered by the caller''s own access to contact_activity.';

GRANT SELECT ON public.contact_last_activity TO authenticated;
