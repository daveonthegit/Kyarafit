-- Supabase Storage setup for all Kyarafit images
-- NOTE: This migration only runs on Supabase PostgreSQL (skips local dev postgres)
-- Bucket must be created via Supabase Dashboard first
-- Folder structure: {userId}/closet/, {userId}/builds/, {userId}/avatars/

DO $$
BEGIN
  -- Check if storage schema exists (Supabase only)
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    -- Drop existing policies if they exist (for re-running migration)
    DROP POLICY IF EXISTS "Public read access" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

    -- Anyone can view (public bucket)
    CREATE POLICY "Public read access"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'kyarafit-images');

    -- Authenticated users can upload to their own folder
    CREATE POLICY "Authenticated users can upload"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'kyarafit-images' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

    -- Users can update their own images
    CREATE POLICY "Users can update own images"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'kyarafit-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

    -- Users can delete their own images
    CREATE POLICY "Users can delete own images"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'kyarafit-images'
      AND (storage.foldername(name))[1] = auth.uid()::text
    );

    RAISE NOTICE 'Supabase storage policies configured successfully';
  ELSE
    RAISE NOTICE 'Skipping Supabase storage setup (storage schema not found - using local postgres)';
  END IF;
END $$;
