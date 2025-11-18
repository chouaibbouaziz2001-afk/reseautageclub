/*
  # Add media_url column to messages table

  1. Changes
    - Add `media_url` column to `messages` table to store URLs for images, videos, and audio files
    - This enables proper display of media content in direct messages
  
  2. Notes
    - Column is nullable as not all messages contain media
    - Works alongside existing `media_type` column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN media_url text;
  END IF;
END $$;
