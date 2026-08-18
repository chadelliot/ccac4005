-- ============================================================================
-- Featured events + homepage countdown
-- ============================================================================
-- An event can be marked "featured", which surfaces it in two places: a
-- countdown banner at the top of the events page, and a thin bar across the
-- top of the homepage carrying the event name and the time remaining.
--
-- Featuring is deliberately not a member-facing switch. Members submit events
-- and an admin approves them; letting a submitter tick a box that puts their
-- own event across the front page of the church's website would hand every
-- member a publishing channel that bypasses review entirely. Only admins
-- holding the `events_review` capability can set it.
-- ============================================================================

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.events.is_featured IS
  'Surfaces the event in the homepage countdown bar and at the top of the events page. Settable only by holders of the events_review capability.';

-- The homepage asks for "the soonest upcoming featured event" on every load,
-- so index exactly that query rather than scanning the table.
CREATE INDEX IF NOT EXISTS events_featured_upcoming_idx
  ON public.events (start_at)
  WHERE is_featured AND status = 'approved' AND is_public;

CREATE OR REPLACE FUNCTION public.enforce_featured_requires_events_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only guard the transition into featured. Editing the title of an event
  -- that is already featured should not require the capability, or an event
  -- reviewer's own later edits would trip over their own flag.
  IF NEW.is_featured AND NOT COALESCE(OLD.is_featured, false) THEN
    -- auth.uid() is NULL for service-role writes (edge functions, migrations,
    -- seeding). Those already bypass RLS entirely, so treating them as trusted
    -- here adds no new access — it just avoids blocking server-side inserts.
    IF auth.uid() IS NOT NULL AND NOT public.has_capability(auth.uid(), 'events_review') THEN
      RAISE EXCEPTION 'Only admins who manage Events can feature an event on the homepage.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_featured_requires_events_review ON public.events;
CREATE TRIGGER trg_enforce_featured_requires_events_review
  BEFORE INSERT OR UPDATE OF is_featured ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.enforce_featured_requires_events_review();
