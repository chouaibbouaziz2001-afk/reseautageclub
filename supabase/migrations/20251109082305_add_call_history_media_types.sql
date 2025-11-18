/*
  # Add Call History Media Types

  1. Changes
    - Update media_type check constraint to include call history types:
      - call_ended
      - call_missed
      - call_rejected
      - call_cancelled
  
  2. Purpose
    - Allow messages table to store call history events
    - Display call logs in message threads
*/

-- Drop existing constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_media_type_check;

-- Add updated constraint with call history types
ALTER TABLE messages ADD CONSTRAINT messages_media_type_check 
  CHECK (media_type = ANY (ARRAY[
    'text'::text, 
    'image'::text, 
    'video'::text, 
    'audio'::text,
    'call_ended'::text,
    'call_missed'::text,
    'call_rejected'::text,
    'call_cancelled'::text
  ]));
