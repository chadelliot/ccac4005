-- ============================================================================
-- Split the territory by area, not by centroid
-- ============================================================================
-- The quadrants were cut at the territory's centroid, which assumes a roughly
-- square shape. This territory is a wedge — wide across the north, tapering to
-- a point at North Avenue — so that split produced 33/22/36/9 percent, and the
-- 9 percent quadrant contained none of the neighbourhoods at all. Weekly
-- assignments drawn from those zones would have been badly lopsided, with one
-- team covering a third of the ground and another almost none.
--
-- Now halved west/east by area, then each half halved north/south by area, by
-- bisection on the true clipped polygons. All four come out at 25.0 percent.
--
-- Names are taken from the neighbourhoods each zone verifiably contains,
-- checked by point-in-polygon rather than assumed. The previous south-eastern
-- name claimed Clifton Park, which lies outside the boundary entirely — the
-- church's route runs along the park's western edge, so the park is the border
-- rather than ground inside it.
-- ============================================================================

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.327741, "lng": -76.609083}, {"lat": 39.344527, "lng": -76.609317}, {"lat": 39.342324, "lng": -76.597274}, {"lat": 39.327742, "lng": -76.597274}]'::jsonb,
    name = 'Pen Lucy & Waverly',
    description = 'The church''s own quarter — York Road corridor from Wilson Park down through Waverly.',
    colour = '#7c3aed',
    sort_order = 1
WHERE sort_order = 1;

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.33121, "lng": -76.597274}, {"lat": 39.342324, "lng": -76.597274}, {"lat": 39.340615, "lng": -76.587933}, {"lat": 39.337091, "lng": -76.574276}, {"lat": 39.33121, "lng": -76.578785}]'::jsonb,
    name = 'Ednor Gardens & Lake Montebello',
    description = 'East of the Alameda, around Lake Montebello and up toward Cold Spring Lane.',
    colour = '#0891b2',
    sort_order = 2
WHERE sort_order = 2;

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.327742, "lng": -76.609083}, {"lat": 39.327742, "lng": -76.597274}, {"lat": 39.31324, "lng": -76.597274}, {"lat": 39.311882, "lng": -76.598978}, {"lat": 39.311382, "lng": -76.608854}]'::jsonb,
    name = 'Better Waverly & East Baltimore Midway',
    description = 'Greenmount corridor south toward North Avenue.',
    colour = '#c2410c',
    sort_order = 3
WHERE sort_order = 3;

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.33121, "lng": -76.597274}, {"lat": 39.331211, "lng": -76.578785}, {"lat": 39.3308, "lng": -76.5791}, {"lat": 39.3235, "lng": -76.5844}, {"lat": 39.31324, "lng": -76.597274}]'::jsonb,
    name = 'Coldstream Homestead Montebello & Darley Park',
    description = 'West of Clifton Park, down toward 1401 E North Avenue. The park itself is the eastern boundary.',
    colour = '#15803d',
    sort_order = 4
WHERE sort_order = 4;

