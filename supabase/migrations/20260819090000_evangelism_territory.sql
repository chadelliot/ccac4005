-- ============================================================================
-- Evangelism territory
-- ============================================================================
-- The area the church has claimed as its focus, and the four quadrants inside
-- it. Boundaries are stored as ordered lat/lng arrays rather than PostGIS
-- geometry: the shapes are a handful of vertices, Postgres has a native
-- polygon type that answers containment on its own, and adding an extension
-- for five points would be a dependency without a job.
--
-- Corners are geocoded from the addresses the church named, not estimated. A
-- territory drawn from guessed coordinates puts the line down the wrong
-- streets, and the whole point is knowing which doors are inside it.
--
-- The quadrants were produced by clipping the territory at its centroid, so
-- they tile it exactly — no gaps that never get worked, no overlaps that get
-- worked twice.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.evangelism_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  boundary JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evangelism_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id UUID NOT NULL REFERENCES public.evangelism_territories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  boundary JSONB NOT NULL,
  colour TEXT NOT NULL DEFAULT '#7c3aed',
  sort_order SMALLINT NOT NULL DEFAULT 0
);

-- One target per week. week_start is the Sunday, so "this week" is a lookup
-- rather than a range scan, and setting the same week twice replaces rather
-- than duplicates.
CREATE TABLE IF NOT EXISTS public.evangelism_focus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.evangelism_zones(id) ON DELETE CASCADE,
  week_start DATE NOT NULL UNIQUE,
  note TEXT,
  set_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.evangelism_territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evangelism_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evangelism_focus ENABLE ROW LEVEL SECURITY;

-- Every member sees the map and the week's target. These are boundaries and
-- place names — no personal information of any kind — which is why they are
-- readable by any signed-in member while the contacts inside them stay
-- restricted to leadership.
CREATE POLICY "Members view territories" ON public.evangelism_territories
  FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "Members view zones" ON public.evangelism_zones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members view focus" ON public.evangelism_focus
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Evangelism managers edit territories" ON public.evangelism_territories
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'evangelism_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'evangelism_management'));
CREATE POLICY "Evangelism managers edit zones" ON public.evangelism_zones
  FOR ALL TO authenticated
  USING (public.has_capability(auth.uid(), 'evangelism_management'))
  WITH CHECK (public.has_capability(auth.uid(), 'evangelism_management'));

GRANT SELECT ON public.evangelism_territories, public.evangelism_zones, public.evangelism_focus TO authenticated;

-- Ordered lat/lng array to a Postgres polygon, so containment is `poly @> point`.
-- lng is x and lat is y, which is the opposite of how they are written; getting
-- that backwards silently puts Baltimore in the Indian Ocean.
CREATE OR REPLACE FUNCTION public.boundary_to_polygon(_boundary JSONB)
RETURNS POLYGON
LANGUAGE SQL IMMUTABLE
AS $$
  SELECT ('(' || string_agg('(' || (e->>'lng') || ',' || (e->>'lat') || ')', ',' ORDER BY ord) || ')')::polygon
  FROM jsonb_array_elements(_boundary) WITH ORDINALITY AS t(e, ord);
$$;

-- Coverage per zone, as counts only.
--
-- SECURITY DEFINER so every member can see how the map is filling up, while
-- the contacts themselves stay behind evangelism_management. The return type
-- carries no name, address, phone or coordinate — there is nothing here that
-- could identify a person, which is what makes it safe to show the whole
-- congregation.
CREATE OR REPLACE FUNCTION public.evangelism_zone_coverage()
RETURNS TABLE (
  zone_id UUID,
  contacts INTEGER,
  gospel_shared INTEGER,
  visited INTEGER,
  baptized INTEGER,
  holy_ghost INTEGER
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    z.id,
    COUNT(c.id)::INTEGER,
    COUNT(c.id) FILTER (WHERE c.gospel_shared)::INTEGER,
    COUNT(c.id) FILTER (WHERE c.visited)::INTEGER,
    COUNT(c.id) FILTER (WHERE c.baptized)::INTEGER,
    COUNT(c.id) FILTER (WHERE c.holy_ghost)::INTEGER
  FROM public.evangelism_zones z
  LEFT JOIN public.evangelism_contacts c
    ON c.latitude IS NOT NULL
   AND c.longitude IS NOT NULL
   AND public.boundary_to_polygon(z.boundary) @> point(c.longitude, c.latitude)
  GROUP BY z.id;
$$;

REVOKE EXECUTE ON FUNCTION public.evangelism_zone_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evangelism_zone_coverage() TO authenticated;

-- Seed: the territory the church named, and its four quadrants.
INSERT INTO public.evangelism_territories (name, description, boundary)
SELECT
  'CCAC Focus Area',
  'From Greenmount and North Avenue up the York Road corridor to 4607 York Rd, east along Cold Spring Lane to Parkside Drive, and back down to 1401 E North Avenue.',
  '[{"lat": 39.344527, "lng": -76.609317}, {"lat": 39.340615, "lng": -76.587933}, {"lat": 39.337091, "lng": -76.574276}, {"lat": 39.311882, "lng": -76.598978}, {"lat": 39.311382, "lng": -76.608854}]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.evangelism_territories WHERE name = 'CCAC Focus Area');

INSERT INTO public.evangelism_zones (territory_id, name, description, boundary, colour, sort_order)
SELECT t.id, 'Wilson Park & Pen Lucy', 'York Road corridor north of the church, up to 4607 York Rd.', '[{"lat": 39.329099, "lng": -76.595872}, {"lat": 39.329099, "lng": -76.609101}, {"lat": 39.344527, "lng": -76.609317}, {"lat": 39.342067, "lng": -76.595872}]'::jsonb, '#7c3aed', 1
FROM public.evangelism_territories t
WHERE t.name = 'CCAC Focus Area'
  AND NOT EXISTS (SELECT 1 FROM public.evangelism_zones z WHERE z.name = 'Wilson Park & Pen Lucy');

INSERT INTO public.evangelism_zones (territory_id, name, description, boundary, colour, sort_order)
SELECT t.id, 'Hillen & Original Northwood', 'Cold Spring Lane across to Parkside Drive, around Lake Montebello.', '[{"lat": 39.329099, "lng": -76.595872}, {"lat": 39.342067, "lng": -76.595872}, {"lat": 39.340615, "lng": -76.587933}, {"lat": 39.337091, "lng": -76.574276}, {"lat": 39.329099, "lng": -76.582107}]'::jsonb, '#0891b2', 2
FROM public.evangelism_territories t
WHERE t.name = 'CCAC Focus Area'
  AND NOT EXISTS (SELECT 1 FROM public.evangelism_zones z WHERE z.name = 'Hillen & Original Northwood');

INSERT INTO public.evangelism_zones (territory_id, name, description, boundary, colour, sort_order)
SELECT t.id, 'Waverly & East Baltimore Midway', 'Greenmount corridor south toward North Avenue.', '[{"lat": 39.329099, "lng": -76.609101}, {"lat": 39.329099, "lng": -76.595872}, {"lat": 39.315052, "lng": -76.595872}, {"lat": 39.311882, "lng": -76.598978}, {"lat": 39.311382, "lng": -76.608854}]'::jsonb, '#c2410c', 3
FROM public.evangelism_territories t
WHERE t.name = 'CCAC Focus Area'
  AND NOT EXISTS (SELECT 1 FROM public.evangelism_zones z WHERE z.name = 'Waverly & East Baltimore Midway');

INSERT INTO public.evangelism_zones (territory_id, name, description, boundary, colour, sort_order)
SELECT t.id, 'Coldstream, Clifton Park & Darley Park', 'East toward 1401 E North Avenue and Clifton Park.', '[{"lat": 39.329099, "lng": -76.595872}, {"lat": 39.329099, "lng": -76.582107}, {"lat": 39.315052, "lng": -76.595872}]'::jsonb, '#15803d', 4
FROM public.evangelism_territories t
WHERE t.name = 'CCAC Focus Area'
  AND NOT EXISTS (SELECT 1 FROM public.evangelism_zones z WHERE z.name = 'Coldstream, Clifton Park & Darley Park');

