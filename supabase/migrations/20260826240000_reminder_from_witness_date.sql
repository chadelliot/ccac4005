-- ============================================================================
-- The new-contact reminder counts from the day they were met
-- ============================================================================
-- Three days after meeting someone is when a follow-up is still warm. Three
-- days after somebody typed them into a form is an accident of when the data
-- entry happened, which for the harvest import was months later.
--
-- Two windows close the reminder off:
--
--   Entered late. If a soul reaches the site more than seven days after they
--   were met, the moment for a "we just met you" call has passed. Creating the
--   reminder anyway would mean chasing a three-week-old conversation on the
--   strength of when a spreadsheet got copied over.
--
--   Simply old. Nothing witnessed more than three weeks ago gets a new-contact
--   reminder for any reason. That is a backstop: it catches the job not having
--   run for a fortnight, a met_on corrected to an old date, or any other way a
--   stale row could suddenly qualify.
--
-- These two rules also make the hard-coded import cutoff unnecessary — the 83
-- souls imported on 25 Aug were all entered weeks or months after they were
-- met, so the promptness rule excludes every one of them on its own merits
-- rather than by a magic date someone has to remember.
-- ============================================================================

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
    SELECT c.id, c.added_by, c.first_name, c.last_name, c.met_on
    FROM public.evangelism_contacts c
    WHERE
      -- Three days on from meeting them, catching up if a run was missed.
      c.met_on <= CURRENT_DATE - 3

      -- But not older than three weeks, whatever the reason.
      AND c.met_on >= CURRENT_DATE - 21

      -- And they reached the site while the meeting was still recent.
      AND (c.created_at::date - c.met_on) <= 7

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
    -- Due today at the earliest. A contact entered on day six of the window
    -- would otherwise be born three days overdue, which reads as neglect
    -- rather than as the reminder it is.
    SELECT id, added_by, GREATEST(met_on + 3, CURRENT_DATE), 1 FROM candidates
    RETURNING contact_id, assigned_to
  )
  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT
    i.assigned_to,
    'Follow up with ' || c.first_name || coalesce(' ' || c.last_name, ''),
    'Met on '
      || to_char(c.met_on, 'FMMon FMDD')
      || ' and nothing has happened on their record since.',
    '/dashboard/evangelism/' || c.id
  FROM inserted i
  JOIN candidates c ON c.id = i.contact_id;

  GET DIAGNOSTICS made = ROW_COUNT;
  RETURN made;
END;
$$;

COMMENT ON FUNCTION public.create_stale_contact_reminders() IS
  'Daily job. One follow-up plus a notification for each soul met three days ago with no activity since — skipped if entered more than a week late or met over three weeks ago. Returns how many were made.';
