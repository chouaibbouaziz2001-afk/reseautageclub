/*
  # Add audio message type to community chat

  1. Changes
    - Drop existing message_type check constraint
    - Add new check constraint that includes 'audio' message type
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE community_chat_messages 
DROP CONSTRAINT IF EXISTS community_chat_messages_message_type_check;

ALTER TABLE community_chat_messages 
ADD CONSTRAINT community_chat_messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'video', 'audio', 'call_ended'));
