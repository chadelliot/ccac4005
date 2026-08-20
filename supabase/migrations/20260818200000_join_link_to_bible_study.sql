-- The public share page moved from /join to /bible-study, which is what gets
-- said aloud. The notification body is written at announce time, so only new
-- announcements are affected — existing rows keep whatever link they were sent
-- with, and rewriting delivered notifications would change what people were
-- already told.
CREATE OR REPLACE FUNCTION public.announce_virtual_service(
  _service_id UUID,
  _platform TEXT,
  _link TEXT DEFAULT NULL,
  _note TEXT DEFAULT NULL
)
RETURNS TABLE (notified INTEGER, meeting_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service public.weekly_services%ROWTYPE;
  v_next TIMESTAMPTZ;
  v_count INTEGER;
  v_when TEXT;
BEGIN
  IF NOT public.has_capability(auth.uid(), 'events_review') THEN
    RAISE EXCEPTION 'You do not have permission to announce a service.';
  END IF;

  IF _platform NOT IN ('zoom', 'facebook', 'other') THEN
    RAISE EXCEPTION 'Unknown meeting platform: %', _platform;
  END IF;

  SELECT * INTO v_service FROM public.weekly_services WHERE id = _service_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such weekly service.';
  END IF;

  v_next := public.next_service_occurrence(v_service.day_of_week, v_service.start_time);

  UPDATE public.weekly_services
  SET is_virtual = true,
      virtual_platform = _platform,
      virtual_link = NULLIF(btrim(COALESCE(_link, '')), ''),
      virtual_note = NULLIF(btrim(COALESCE(_note, '')), ''),
      virtual_until = v_next + INTERVAL '3 hours',
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = _service_id;

  v_when := to_char(v_next AT TIME ZONE 'America/New_York', 'FMDay FMHH12:MI AM');

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT
    p.id,
    v_service.title || ' is online this week',
    CASE _platform
      WHEN 'zoom' THEN 'We are meeting on Zoom, ' || v_when || '. Tap to join or share the link.'
      WHEN 'facebook' THEN 'We are meeting in the Facebook group chat, ' || v_when || '. Tap for details.'
      ELSE 'We are meeting online, ' || v_when || '. Tap for details.'
    END,
    '/bible-study'
  FROM public.profiles p;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_next;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.announce_virtual_service(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announce_virtual_service(UUID, TEXT, TEXT, TEXT) TO authenticated;
