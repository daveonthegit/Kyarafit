-- Remove storage policies
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

-- Note: Bucket deletion should be done via Supabase Dashboard
-- DELETE FROM storage.buckets WHERE id = 'kyarafit-images';
