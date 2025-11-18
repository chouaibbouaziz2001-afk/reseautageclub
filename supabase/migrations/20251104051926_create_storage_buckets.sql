/*
  # Create Supabase Storage Buckets for File Management

  ## Overview
  This migration creates two storage buckets to manage all files in the application:
  
  1. **websiteconfig** (Public Bucket)
     - Purpose: Store public website assets (logos, banners, configuration files)
     - Access: Publicly readable by anyone
     - Use cases: Site logos, event banners, community avatars
  
  2. **user-media** (Private Bucket)
     - Purpose: Store user-generated content
     - Access: Private, accessible only by file owner with signed URLs
     - Use cases: Profile pictures, post images/videos/audio, chat media, event images
  
  ## Security
  - websiteconfig: Public read access for all files
  - user-media: Private access with RLS policies ensuring users can only access their own files
  
  ## Buckets Configuration
  - Both buckets have file size limits (50MB for user-media, 10MB for websiteconfig)
  - Allowed MIME types configured for security
*/

-- Create websiteconfig bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'websiteconfig',
  'websiteconfig',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

-- Create user-media bucket (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-media',
  'user-media',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg'];

-- websiteconfig bucket policies (public read access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Public read access for websiteconfig'
  ) THEN
    CREATE POLICY "Public read access for websiteconfig"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'websiteconfig');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can upload to websiteconfig'
  ) THEN
    CREATE POLICY "Authenticated users can upload to websiteconfig"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'websiteconfig');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can update websiteconfig'
  ) THEN
    CREATE POLICY "Authenticated users can update websiteconfig"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'websiteconfig')
      WITH CHECK (bucket_id = 'websiteconfig');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Authenticated users can delete from websiteconfig'
  ) THEN
    CREATE POLICY "Authenticated users can delete from websiteconfig"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'websiteconfig');
  END IF;
END $$;

-- user-media bucket policies (private, owner-only access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can view their own media'
  ) THEN
    CREATE POLICY "Users can view their own media"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'user-media' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can upload their own media'
  ) THEN
    CREATE POLICY "Users can upload their own media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'user-media' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can update their own media'
  ) THEN
    CREATE POLICY "Users can update their own media"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'user-media' AND
        (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'user-media' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Users can delete their own media'
  ) THEN
    CREATE POLICY "Users can delete their own media"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'user-media' AND
        (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
