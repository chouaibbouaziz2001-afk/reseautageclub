/*
  # Create Media Storage Bucket for Admin Chat

  1. Storage Setup
    - Create `media` bucket for storing images, videos, and audio files
    - Set public access for easy viewing/listening
    - Configure generous file size limits (50MB)

  2. Security
    - Enable RLS on storage.objects
    - Allow authenticated users to upload files
    - Allow anyone to view/listen to media files
    - Allow users to delete their own files

  3. Supported Media Types
    - Images: JPEG, PNG, GIF, WebP
    - Videos: MP4, WebM, QuickTime
    - Audio: WebM, MP3, WAV, OGG, M4A
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mp4'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to media bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media');

CREATE POLICY "Anyone can view media bucket files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'media');

CREATE POLICY "Users can delete own files in media bucket"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'media' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );