-- ============================================================================
-- Trace the south-eastern edge properly
-- ============================================================================
-- The territory ran a straight chord from 3000 Parkside Dr to 1401 E North Ave.
-- The church's actual route bows east there — past Lake Montebello, then down
-- the western side of Clifton Park — so the chord cut the corner and left the
-- lake surrounds and part of Clifton Park outside the territory. At its widest
-- the two lines differ by roughly 275 metres, which is the difference between
-- that ground being ours to work or not.
--
-- Two waypoints added, placed against geocoded landmarks: east of Lake
-- Montebello (centre 39.3316, -76.5848) and above Clifton Park Golf Course
-- (39.3225, -76.5829).
--
-- The quadrants are re-clipped from the new outline. They are derived from the
-- territory, so leaving them alone would have left them disagreeing with the
-- boundary they are supposed to divide.
-- ============================================================================

UPDATE public.evangelism_territories
SET boundary = '[{"lat": 39.344527, "lng": -76.609317}, {"lat": 39.340615, "lng": -76.587933}, {"lat": 39.337091, "lng": -76.574276}, {"lat": 39.3308, "lng": -76.5791}, {"lat": 39.3235, "lng": -76.5844}, {"lat": 39.311882, "lng": -76.598978}, {"lat": 39.311382, "lng": -76.608854}]'::jsonb,
    updated_at = now()
WHERE name = 'CCAC Focus Area';

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.328542, "lng": -76.591837}, {"lat": 39.328542, "lng": -76.609094}, {"lat": 39.344527, "lng": -76.609317}, {"lat": 39.341329, "lng": -76.591837}]'::jsonb
WHERE name = 'Wilson Park & Pen Lucy';

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.328542, "lng": -76.591837}, {"lat": 39.341329, "lng": -76.591837}, {"lat": 39.340615, "lng": -76.587933}, {"lat": 39.337091, "lng": -76.574276}, {"lat": 39.3308, "lng": -76.5791}, {"lat": 39.328542, "lng": -76.580739}]'::jsonb
WHERE name = 'Hillen & Original Northwood';

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.328542, "lng": -76.609094}, {"lat": 39.328542, "lng": -76.591837}, {"lat": 39.317573, "lng": -76.591837}, {"lat": 39.311882, "lng": -76.598978}, {"lat": 39.311382, "lng": -76.608854}]'::jsonb
WHERE name = 'Waverly & East Baltimore Midway';

UPDATE public.evangelism_zones
SET boundary = '[{"lat": 39.328542, "lng": -76.591837}, {"lat": 39.328542, "lng": -76.580739}, {"lat": 39.3235, "lng": -76.5844}, {"lat": 39.317573, "lng": -76.591837}]'::jsonb
WHERE name = 'Coldstream, Clifton Park & Darley Park';

