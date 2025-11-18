/*
  # Create Media Storage Bucket

  1. Storage Setup
    - Create `community-media` bucket for storing user-uploaded images and videos
    - Set public access for easy viewing
    - Configure file size limits

  2. Security
    - Enable RLS on storage.objects
    - Allow authenticated users to upload files
    - Allow authenticated users to read files
    - Allow users to delete their own files
    - Restrict file types to images and videos only
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'community-media',
  'community-media',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'community-media');

CREATE POLICY "Anyone can view media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'community-media');

CREATE POLICY "Users can delete own media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'community-media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );