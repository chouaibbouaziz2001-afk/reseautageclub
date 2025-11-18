/*
  # Add Audio Support to Community Posts

  1. Modifications
    - Drop existing media_type constraint on `community_posts`
    - Add new constraint including 'audio' type
    - Add `audio_url` column for audio file URLs
  
  2. Important Notes
    - Allows community members to post audio files
    - Applies to all existing and future communities
    - Audio files stored in Supabase media bucket
*/

-- Drop the existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'community_posts' AND constraint_name = 'community_posts_media_type_check'
  ) THEN
    ALTER TABLE community_posts DROP CONSTRAINT community_posts_media_type_check;
  END IF;
END $$;

-- Add audio_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'audio_url'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN audio_url text;
  END IF;
END $$;

-- Add new constraint with audio type
ALTER TABLE community_posts ADD CONSTRAINT community_posts_media_type_check 
  CHECK (media_type IN ('text', 'image', 'video', 'audio'));