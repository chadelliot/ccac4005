-- ============================================================================
-- Saturday evangelism assignments
-- ============================================================================
-- The territory is the ground the church has claimed for the season; this is
-- where we are actually knocking this Saturday. Separate tables because they
-- change on completely different clocks — the territory holds for months, the
-- assignment is redrawn every week — and folding the week's pins into the zone
-- rows would mean rewriting the territory every time.
--
-- Anchored to Saturday because that is when the church goes out. It is stored
-- as a date rather than assumed, so moving to a different day later is a
-- change of value, not a change of schema.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evangelism_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One assignment per outing. Unique so saving twice replaces rather than
  -- silently leaving two sets of pins for the same morning.
  assignment_date DATE NOT NULL UNIQUE,
  zone_id UUID REFERENCES public.evangelism_zones(id) ON DELETE SET NULL,
  note TEXT,
  meet_at TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evangelism_assignment_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.evangelism_assignments(id) ON DELETE CASCADE,
  latitude NUMERIC(9, 6) NOT NULL,
  longitude NUMERIC(9, 6) NOT NULL,
  label TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS assignment_points_assignment_idx
  ON public.evangelism_assignment_points (assignment_id, sort_order);

ALTER TABLE public.evangelism_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evangelism_assignment_points ENABLE ROW LEVEL SECURITY;

-- Every member sees where we're going. These are street corners, not people.
CREATE POLICY "Members view assignments" ON public.evangelism_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members view assignment points" ON public.evangelism_assignment_points
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Evangelism managers edit assignments" ON public.evangelism_assignments
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'evangelism_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'evangelism_management'));
CREATE POLICY "Evangelism managers edit assignment points" ON public.evangelism_assignment_points
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'evangelism_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'evangelism_management'));

GRANT SELECT ON public.evangelism_assignments, public.evangelism_assignment_points TO authenticated;

-- The Saturday we're working next. Today counts if today is Saturday, so the
-- morning of the outing still shows the pins rather than jumping a week ahead.
CREATE OR REPLACE FUNCTION public.next_saturday()
RETURNS DATE
LANGUAGE SQL STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'America/New_York')::date
       + ((6 - EXTRACT(DOW FROM (now() AT TIME ZONE 'America/New_York'))::INTEGER + 7) % 7);
$$;

GRANT EXECUTE ON FUNCTION public.next_saturday() TO authenticated;

-- Save the week's pins and tell everyone, in one call.
--
-- Points arrive as a JSON array so the whole set is replaced atomically. Saving
-- them one row at a time from the browser would leave a half-drawn route
-- visible to members the moment the first insert landed.
CREATE OR REPLACE FUNCTION public.save_evangelism_assignment(
  _assignment_date DATE,
  _points JSONB,
  _zone_id UUID DEFAULT NULL,
  _note TEXT DEFAULT NULL,
  _meet_at TEXT DEFAULT NULL,
  _notify BOOLEAN DEFAULT true
)
RETURNS TABLE (assignment_id UUID, points INTEGER, notified INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_id UUID;
  v_points INTEGER;
  v_notified INTEGER := 0;
  v_zone_name TEXT;
BEGIN
  IF NOT public.has_capability(auth.uid(), 'evangelism_management') THEN
    RAISE EXCEPTION 'You do not have permission to set the evangelism assignment.';
  END IF;

  INSERT INTO public.evangelism_assignments (assignment_date, zone_id, note, meet_at, created_by)
  VALUES (_assignment_date, _zone_id, NULLIF(btrim(COALESCE(_note, '')), ''), NULLIF(btrim(COALESCE(_meet_at, '')), ''), auth.uid())
  ON CONFLICT (assignment_date) DO UPDATE
    SET zone_id = EXCLUDED.zone_id,
        note = EXCLUDED.note,
        meet_at = EXCLUDED.meet_at,
        updated_at = now()
  RETURNING id INTO v_id;

  -- Replace wholesale: the admin has just drawn the route they want, and
  -- merging with last week's pins would leave stragglers on the map.
  DELETE FROM public.evangelism_assignment_points WHERE assignment_id = v_id;

  INSERT INTO public.evangelism_assignment_points (assignment_id, latitude, longitude, label, sort_order)
  SELECT v_id,
         (e->>'lat')::NUMERIC,
         (e->>'lng')::NUMERIC,
         NULLIF(btrim(COALESCE(e->>'label', '')), ''),
         (ord - 1)::SMALLINT
  FROM jsonb_array_elements(COALESCE(_points, '[]'::jsonb)) WITH ORDINALITY AS t(e, ord);

  GET DIAGNOSTICS v_points = ROW_COUNT;

  IF _notify THEN
    SELECT z.name INTO v_zone_name FROM public.evangelism_zones z WHERE z.id = _zone_id;

    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT
      p.id,
      'Saturday''s evangelism assignment is up',
      COALESCE(
        NULLIF(btrim(COALESCE(_note, '')), ''),
        'We''re out on ' || to_char(_assignment_date, 'FMDay FMDD FMMonth')
          || COALESCE(' in ' || v_zone_name, '') || '. Open the map to see the stops.'
      ),
      '/dashboard/evangelism'
    FROM public.profiles p;

    GET DIAGNOSTICS v_notified = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_id, v_points, v_notified;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_evangelism_assignment(DATE, JSONB, UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_evangelism_assignment(DATE, JSONB, UUID, TEXT, TEXT, BOOLEAN) TO authenticated;

-- The assignment for a given date, pins included, as one row.
CREATE OR REPLACE FUNCTION public.evangelism_assignment_for(_on DATE)
RETURNS TABLE (
  id UUID,
  assignment_date DATE,
  zone_id UUID,
  zone_name TEXT,
  note TEXT,
  meet_at TEXT,
  points JSONB
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.assignment_date,
    a.zone_id,
    z.name,
    a.note,
    a.meet_at,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('lat', p.latitude, 'lng', p.longitude, 'label', p.label) ORDER BY p.sort_order)
       FROM public.evangelism_assignment_points p WHERE p.assignment_id = a.id),
      '[]'::jsonb
    )
  FROM public.evangelism_assignments a
  LEFT JOIN public.evangelism_zones z ON z.id = a.zone_id
  WHERE a.assignment_date = _on;
$$;

REVOKE EXECUTE ON FUNCTION public.evangelism_assignment_for(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evangelism_assignment_for(DATE) TO authenticated;
