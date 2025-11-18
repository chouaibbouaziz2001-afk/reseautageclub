/*
  # Add Media Support to Direct Messages

  1. Changes
    - Add `media_type` column to messages table
    - Allows messages to include images, videos, and audio recordings
    - Defaults to 'text' for backward compatibility
  
  2. Media Types
    - 'text' - Regular text messages (default)
    - 'image' - Image attachments
    - 'video' - Video attachments
    - 'audio' - Voice recordings
*/

-- Add media_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_type text DEFAULT 'text';
  END IF;
END $$;

-- Add constraint to validate media types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'messages' AND constraint_name = 'messages_media_type_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_media_type_check 
      CHECK (media_type IN ('text', 'image', 'video', 'audio'));
  END IF;
END $$;