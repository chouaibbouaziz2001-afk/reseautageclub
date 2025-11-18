/*
  # Add Media Support to Co-founder Profiles

  1. Changes
    - Add `demo_video_url` column to store startup demo video
    - Add `pitch_images` column to store array of pitch deck/product images (max 4)

  2. Details
    - demo_video_url: Text field for video URL from storage
    - pitch_images: Text array to store up to 4 image URLs
    - Both fields are optional (nullable)

  3. Notes
    - Images are limited to 4 maximum in the application logic
    - URLs will point to the users_medias storage bucket
*/

DO $$
BEGIN
  -- Add demo video URL column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cofounder_profiles' AND column_name = 'demo_video_url'
  ) THEN
    ALTER TABLE cofounder_profiles ADD COLUMN demo_video_url text;
  END IF;

  -- Add pitch images array column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cofounder_profiles' AND column_name = 'pitch_images'
  ) THEN
    ALTER TABLE cofounder_profiles ADD COLUMN pitch_images text[] DEFAULT ARRAY[]::text[];
  END IF;
END $$;
