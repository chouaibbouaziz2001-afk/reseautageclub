/*
  # Add Video Support to Posts

  1. Changes
    - Add `video_url` column to `posts` table to store video data (base64 or URL)
    - Add `media_type` column to distinguish between image and video posts
  
  2. Notes
    - Videos will be stored as base64 data initially
    - media_type can be 'image', 'video', or null for text-only posts
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE posts ADD COLUMN video_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE posts ADD COLUMN media_type text;
  END IF;
END $$;
