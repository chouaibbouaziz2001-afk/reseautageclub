/*
  # Allow Nullable Content for Media Messages

  ## Changes
  - Make `content` column nullable in the `messages` table
  
  ## Rationale
  - Media messages (images, videos, audio) should not require text content
  - Users should be able to send media without adding a caption
  - The `media_url` field contains the actual media content reference
  
  ## Safety
  - This is a non-destructive change that only relaxes constraints
  - Existing data remains unchanged
*/

-- Make content nullable for media-only messages
ALTER TABLE messages 
ALTER COLUMN content DROP NOT NULL;
