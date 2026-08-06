-- Events: tell admins something is waiting, and stop announcing event times in
-- the wrong timezone.

-- ---------------------------------------------------------------------------
-- 1. Notify admins when an event is submitted
-- ---------------------------------------------------------------------------
-- Approval already notifies every member, but nothing told the admins there was
-- anything to approve — a submission could sit pending indefinitely with the
-- submitter assuming it was seen.

CREATE OR REPLACE FUNCTION public.notify_admins_on_event_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT
      ur.user_id,
      'Event awaiting approval: ' || NEW.title,
      COALESCE(
        to_char(NEW.start_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH12:MI AM'),
        ''
      ) || COALESCE(' • ' || NEW.location, ''),
      '/dashboard/events/' || NEW.id::text
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      -- No point telling an admin about their own submission.
      AND ur.user_id <> NEW.submitted_by;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_admins_on_event_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_admins_on_event_submission ON public.events;

CREATE TRIGGER trg_notify_admins_on_event_submission
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_event_submission();

-- ---------------------------------------------------------------------------
-- 2. Approval notifications were announcing UTC times
-- ---------------------------------------------------------------------------
-- A 7:00 PM service was going out to every member as "23:00". Render in church
-- local time, in 12-hour form, and skip notifying the submitter about their own
-- event.

CREATE OR REPLACE FUNCTION public.notify_members_on_event_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT
      p.id,
      'New event: ' || NEW.title,
      COALESCE(
        to_char(NEW.start_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH12:MI AM'),
        ''
      ) || COALESCE(' • ' || NEW.location, ''),
      '/dashboard/events/' || NEW.id::text
    FROM public.profiles p
    WHERE p.id <> NEW.submitted_by;
  END IF;
  RETURN NEW;
END;
$$;
