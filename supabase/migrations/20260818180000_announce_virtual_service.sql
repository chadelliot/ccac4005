-- ============================================================================
-- Announcing that a weekly gathering is meeting online
-- ============================================================================
-- One call does the whole job: records where we are meeting, works out when
-- that decision should lapse, and notifies every member. Doing it in three
-- round trips from the browser would leave the door open to a half-announced
-- state — the link saved but nobody told, or worse, everyone told about a link
-- that failed to save.
-- ============================================================================

-- The next time a weekly service meets, as an instant.
--
-- Computed in America/New_York because "Tuesday at 7pm" means 7pm in
-- Baltimore. Doing this in UTC drifts by an hour twice a year, which would
-- expire an announcement mid-service every spring.
CREATE OR REPLACE FUNCTION public.next_service_occurrence(_day_of_week SMALLINT, _start_time TIME)
RETURNS TIMESTAMPTZ
LANGUAGE SQL
STABLE
SET search_path = public
AS $$
  WITH local_now AS (
    SELECT (now() AT TIME ZONE 'America/New_York') AS ts
  ),
  candidates AS (
    SELECT ((date_trunc('day', ln.ts) + make_interval(days => d))::date + _start_time) AS local_ts
    FROM local_now ln, generate_series(0, 7) AS d
  )
  SELECT MIN(c.local_ts AT TIME ZONE 'America/New_York')
  FROM candidates c, local_now ln
  WHERE EXTRACT(DOW FROM c.local_ts) = _day_of_week
    -- A service that began within the last two hours is still "now", so an
    -- announcement made at ten past seven applies to tonight, not next week.
    AND c.local_ts >= ln.ts - INTERVAL '2 hours';
$$;

-- Announce that a service is meeting online this week.
--
-- SECURITY DEFINER because it writes notifications for every member, which no
-- ordinary caller may do. The capability check is therefore the gate, and it
-- is checked first.
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
      -- Three hours past the start, so the announcement clears itself once the
      -- gathering is over. Nobody has to remember to switch it back, and a
      -- forgotten toggle cannot tell next week's visitors the wrong thing.
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
    '/join'
  FROM public.profiles p;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_next;
END;
$$;

-- Undo, for a change of plan before the gathering.
CREATE OR REPLACE FUNCTION public.clear_virtual_service(_service_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_capability(auth.uid(), 'events_review') THEN
    RAISE EXCEPTION 'You do not have permission to change a service.';
  END IF;

  UPDATE public.weekly_services
  SET is_virtual = false,
      virtual_platform = NULL,
      virtual_link = NULL,
      virtual_note = NULL,
      virtual_until = NULL,
      updated_at = now(),
      updated_by = auth.uid()
  WHERE id = _service_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.announce_virtual_service(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.clear_virtual_service(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.announce_virtual_service(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_virtual_service(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_service_occurrence(SMALLINT, TIME) TO anon, authenticated;
