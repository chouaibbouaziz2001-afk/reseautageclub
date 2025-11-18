/*
  # Add Video and Banner Fields to Community Courses

  1. Changes
    - Add `video_url` column to community_courses for course intro/promo video
    - Add `banner_url` column to community_courses for course banner image
    - These fields allow richer course presentation in the learning center

  2. Notes
    - Both fields are optional (nullable)
    - URLs will point to files in Supabase storage (users-medias bucket)
*/

DO $$ 
BEGIN
  -- Add video_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_courses' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE community_courses ADD COLUMN video_url text;
  END IF;

  -- Add banner_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_courses' AND column_name = 'banner_url'
  ) THEN
    ALTER TABLE community_courses ADD COLUMN banner_url text;
  END IF;
END $$;
