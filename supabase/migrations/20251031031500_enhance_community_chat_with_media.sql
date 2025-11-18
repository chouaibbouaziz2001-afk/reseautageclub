/*
  # Enhance Community Chat with Media Support

  1. Changes to existing tables
    - Add columns to `community_chat_messages`:
      - `message_type` (text, 'text', 'image', 'video', 'call_ended')
      - `media_url` (text, nullable)
      - `call_duration` (integer, nullable)
      - `updated_at` (timestamptz)
    
    - Add columns to `community_calls`:
      - `duration` (integer, for storing call length in seconds)
      - `participant_count` (integer, number of participants)

  2. Indexes
    - Add index on message type for filtering
    - Add index on created_at for sorting
*/

-- Add columns to community_chat_messages
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_chat_messages' AND column_name = 'message_type'
  ) THEN
    ALTER TABLE community_chat_messages 
    ADD COLUMN message_type text NOT NULL DEFAULT 'text' 
    CHECK (message_type IN ('text', 'image', 'video', 'call_ended'));
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_chat_messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE community_chat_messages ADD COLUMN media_url text;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_chat_messages' AND column_name = 'call_duration'
  ) THEN
    ALTER TABLE community_chat_messages ADD COLUMN call_duration integer;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_chat_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE community_chat_messages ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add columns to community_calls
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_calls' AND column_name = 'duration'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN duration integer;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_calls' AND column_name = 'participant_count'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN participant_count integer DEFAULT 0;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_type ON community_chat_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_created_at ON community_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_calls_community_status ON community_calls(community_id, status);
