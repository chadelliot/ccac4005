-- ============================================================================
-- This week's evangelism target
-- ============================================================================
-- An admin picks a quadrant for the week; every member is told, and the map
-- shows it. One call, so the target cannot be set without anyone hearing about
-- it, or announced for a zone that failed to save.
-- ============================================================================

-- The Sunday that starts the current week, in the church's own time zone.
-- date_trunc('week') in Postgres starts on Monday, which would roll the target
-- over a day late every week.
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS DATE
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT (
    (now() AT TIME ZONE 'America/New_York')::date
    - EXTRACT(DOW FROM (now() AT TIME ZONE 'America/New_York'))::INTEGER
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_week_start() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_evangelism_focus(_zone_id UUID, _note TEXT DEFAULT NULL)
RETURNS TABLE (notified INTEGER, week_start DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone public.evangelism_zones%ROWTYPE;
  v_week DATE;
  v_count INTEGER;
BEGIN
  IF NOT public.has_capability(auth.uid(), 'evangelism_management') THEN
    RAISE EXCEPTION 'You do not have permission to set the evangelism target.';
  END IF;

  SELECT * INTO v_zone FROM public.evangelism_zones WHERE id = _zone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No such zone.';
  END IF;

  v_week := public.current_week_start();

  -- One target per week: choosing again replaces rather than stacking, so the
  -- map can never show two.
  INSERT INTO public.evangelism_focus (zone_id, week_start, note, set_by)
  VALUES (_zone_id, v_week, NULLIF(btrim(COALESCE(_note, '')), ''), auth.uid())
  ON CONFLICT (week_start) DO UPDATE
    SET zone_id = EXCLUDED.zone_id,
        note = EXCLUDED.note,
        set_by = EXCLUDED.set_by,
        created_at = now();

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT
    p.id,
    'This week we''re praying over ' || v_zone.name,
    COALESCE(
      NULLIF(btrim(COALESCE(_note, '')), ''),
      'Our focus area this week. Open the map to see the streets, and pray for the doors we''ll knock.'
    ),
    '/dashboard/evangelism'
  FROM public.profiles p;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN QUERY SELECT v_count, v_week;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_evangelism_focus(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_evangelism_focus(UUID, TEXT) TO authenticated;

-- This week's target, resolved for the map. Readable by every member: it is a
-- zone name and a boundary, carrying no personal information.
CREATE OR REPLACE FUNCTION public.current_evangelism_focus()
RETURNS TABLE (zone_id UUID, zone_name TEXT, boundary JSONB, colour TEXT, note TEXT, week_start DATE)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT z.id, z.name, z.boundary, z.colour, f.note, f.week_start
  FROM public.evangelism_focus f
  JOIN public.evangelism_zones z ON z.id = f.zone_id
  WHERE f.week_start = public.current_week_start();
$$;

REVOKE EXECUTE ON FUNCTION public.current_evangelism_focus() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_evangelism_focus() TO authenticated;
