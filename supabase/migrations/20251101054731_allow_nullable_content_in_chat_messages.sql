/*
  # Allow nullable content in chat messages

  1. Changes
    - Make `content` column nullable in `community_chat_messages` table
    - This allows media-only messages (audio, video, images) without text content
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE community_chat_messages 
ALTER COLUMN content DROP NOT NULL;
