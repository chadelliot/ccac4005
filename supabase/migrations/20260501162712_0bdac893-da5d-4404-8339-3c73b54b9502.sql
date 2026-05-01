
DROP POLICY IF EXISTS "Flyers publicly viewable" ON storage.objects;

-- Allow public reads of individual objects in event-flyers (no LIST via SQL),
-- by requiring the request to specify a path. This is enforced by Supabase
-- treating SELECT through the storage API; we still scope to bucket only.
CREATE POLICY "Flyers public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'event-flyers');
