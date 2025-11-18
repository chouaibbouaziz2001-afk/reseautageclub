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