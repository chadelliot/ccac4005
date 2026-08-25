-- ============================================================================
-- Events that belong to one group
-- ============================================================================
-- The women's and men's ministries want their own events: seen by their own
-- members, and announced to them alone.
--
-- Three things were in the way. The events table already had group_id but
-- nothing set it; the approval trigger notified every profile in the church
-- regardless; and "Members view approved events" showed every approved event to
-- every member, so a group event would have been announced narrowly and then
-- been visible to everyone anyway.
--
-- No AI is involved in any of this, and never was. A notification is a row.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Visibility
-- ----------------------------------------------------------------------------
-- A group event belongs to its group. Church-wide events (group_id IS NULL)
-- behave exactly as before.
DROP POLICY IF EXISTS "Members view approved events" ON public.events;
CREATE POLICY "Members view approved and their group's events" ON public.events
  FOR SELECT TO authenticated
  USING (
    status = 'approved'
    AND (
      group_id IS NULL
      OR public.is_group_member(auth.uid(), group_id)
      OR public.is_group_leader(auth.uid(), group_id)
    )
  );

-- The public page reads through "Public can view approved public events", which
-- checks is_public. A group event marked public would appear on the website —
-- which is a legitimate choice for, say, a women's conference open to visitors —
-- so that policy is deliberately left alone. Marking a group event public is how
-- you say "the whole world may see this"; leaving it private keeps it to the
-- group.

-- ----------------------------------------------------------------------------
-- Notification
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_members_on_event_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_name TEXT;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    IF NEW.group_id IS NOT NULL THEN
      SELECT g.name INTO v_group_name FROM public.groups g WHERE g.id = NEW.group_id;

      -- Only this group's members. Announcing a men's ministry breakfast to the
      -- whole church is how people learn to ignore notifications.
      INSERT INTO public.notifications (user_id, title, body, link)
      SELECT
        gm.user_id,
        COALESCE(v_group_name || ': ', '') || NEW.title,
        COALESCE(
          to_char(NEW.start_at AT TIME ZONE 'America/New_York', 'Mon DD, YYYY at HH12:MI AM'),
          ''
        ) || COALESCE(' • ' || NEW.location, ''),
        '/dashboard/events/' || NEW.id::text
      FROM public.group_members gm
      WHERE gm.group_id = NEW.group_id
        AND gm.user_id IS DISTINCT FROM NEW.submitted_by;
    ELSE
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
  END IF;
  RETURN NEW;
END;
$$;
