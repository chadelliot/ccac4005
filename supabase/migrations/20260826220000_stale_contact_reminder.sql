-- ============================================================================
-- One nudge, three days later, only if nobody went back
-- ============================================================================
-- Replaces the three scheduled touches with a single conditional reminder: if a
-- soul has been on the books for three days and nothing has happened on their
-- record, the person who logged them is reminded and notified.
--
-- Conditional is the whole point. The old schedule created work whether or not
-- it was warranted; this only speaks up when the thing it is worried about has
-- actually occurred — a name written down and then left alone.
-- ============================================================================

-- Asked for explicitly. The table holds nothing at time of writing, so this is
-- a statement of intent as much as a deletion: everything from here is either
-- created by hand or by the reminder below.
DELETE FROM public.contact_follow_ups;

CREATE OR REPLACE FUNCTION public.create_stale_contact_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  made integer := 0;
BEGIN
  WITH candidates AS (
    SELECT c.id, c.added_by, c.first_name, c.last_name
    FROM public.evangelism_contacts c
    WHERE
      -- The harvest import of 25 Aug 2026 put 83 souls in on one day. Without
      -- this line every one of them without activity would fire a reminder on
      -- the same morning — eighty notifications nobody asked for, which is the
      -- self-filling queue this feature exists to avoid. Only souls logged from
      -- the day this shipped are eligible.
      c.created_at >= DATE '2026-08-26'

      -- Three days on, and catching up if a run was missed rather than only
      -- firing on the exact day.
      AND c.created_at::date <= CURRENT_DATE - 3

      -- Someone who asked to be left alone is not an oversight to chase.
      AND c.status <> 'do_not_contact'

      -- Activity on a later day than the record was made. A note typed while
      -- logging the soul is part of writing them down, not evidence that
      -- anybody went back — counting it would silence the reminder for exactly
      -- the contacts most likely to need it.
      AND NOT EXISTS (
        SELECT 1 FROM public.contact_activity a
        WHERE a.contact_id = c.id
          AND a.created_at::date > c.created_at::date
      )

      -- Somebody has already committed to something here; leave it alone.
      AND NOT EXISTS (
        SELECT 1 FROM public.contact_follow_ups f WHERE f.contact_id = c.id
      )

      -- notifications.user_id must point at a real account.
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.added_by)
  ),
  inserted AS (
    INSERT INTO public.contact_follow_ups (contact_id, assigned_to, due_date, touch_number)
    SELECT id, added_by, CURRENT_DATE, 1 FROM candidates
    RETURNING contact_id, assigned_to
  )
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT
    i.assigned_to,
    'Follow up with ' || c.first_name || coalesce(' ' || c.last_name, ''),
    'Logged three days ago and nothing has happened on their record since.',
    '/dashboard/evangelism/' || c.id
  FROM inserted i
  JOIN candidates c ON c.id = i.contact_id;

  GET DIAGNOSTICS made = ROW_COUNT;
  RETURN made;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_stale_contact_reminders() FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.create_stale_contact_reminders() IS
  'Daily job. One follow-up plus a notification for each soul logged three days ago with no activity since. Returns how many were made.';
