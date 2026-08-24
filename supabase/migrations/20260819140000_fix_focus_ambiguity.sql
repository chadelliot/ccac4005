-- week_start is both an OUT parameter of this function and a column of the
-- table it writes to, so PL/pgSQL could not tell which the ON CONFLICT target
-- meant and refused the whole statement. #variable_conflict use_column makes
-- ambiguous names resolve to the column, which is what every reference in the
-- body wants; the value being inserted travels in v_week, which is
-- unambiguous. Renaming the OUT parameter would have fixed it too, but that is
-- the name the client reads back, so it would have changed the API to dodge a
-- one-line declaration.
CREATE OR REPLACE FUNCTION public.set_evangelism_focus(_zone_id UUID, _note TEXT DEFAULT NULL)
RETURNS TABLE (notified INTEGER, week_start DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
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

  INSERT INTO public.evangelism_focus AS f (zone_id, week_start, note, set_by)
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
