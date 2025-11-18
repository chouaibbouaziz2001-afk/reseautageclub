/*
  # Create Direct Messaging System

  This migration implements a comprehensive 1-on-1 messaging system for private conversations between entrepreneurs.

  ## 1. New Tables
    
    ### `conversations`
    - `id` (uuid, primary key) - Unique identifier for the conversation
    - `participant_1_id` (uuid) - First participant's user ID
    - `participant_2_id` (uuid) - Second participant's user ID
    - `created_at` (timestamptz) - When the conversation was started
    - `updated_at` (timestamptz) - Last activity timestamp (for sorting)
    - Unique constraint on participant pair to prevent duplicate conversations
    - Check constraint to ensure participants are different users
    
    ### `messages`
    - `id` (uuid, primary key) - Unique identifier for the message
    - `conversation_id` (uuid) - Reference to the conversation
    - `sender_id` (uuid) - User who sent the message
    - `content` (text) - Message content
    - `read` (boolean) - Whether the message has been read by recipient
    - `created_at` (timestamptz) - When the message was sent
    - Foreign key cascading deletes for data integrity

  ## 2. Security
    
    ### Conversations Table RLS Policies
    - Enable RLS on `conversations` table
    - Users can view conversations they are part of (as either participant)
    - Users can create conversations (must be one of the participants)
    - Users can update conversations they are part of (for updated_at)
    
    ### Messages Table RLS Policies
    - Enable RLS on `messages` table
    - Users can view messages in their conversations
    - Users can create messages in their conversations (as sender)
    - Users can update messages they received (to mark as read)
    - Users cannot update messages they sent

  ## 3. Important Notes
    - Indexes on foreign keys and frequently queried columns for performance
    - Cascading deletes maintain data integrity
    - Check constraints prevent invalid data
    - RLS ensures users can only access their own conversations
    - Read status enables unread message indicators
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT conversations_different_participants CHECK (participant_1_id != participant_2_id),
  CONSTRAINT conversations_unique_pair UNIQUE (participant_1_id, participant_2_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participant_1 ON conversations(participant_1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_2 ON conversations(participant_2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  );

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = participant_1_id OR auth.uid() = participant_2_id) AND
    participant_1_id != participant_2_id
  );

CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  )
  WITH CHECK (
    auth.uid() = participant_1_id OR 
    auth.uid() = participant_2_id
  );

CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );

CREATE POLICY "Users can mark received messages as read"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  )
  WITH CHECK (
    auth.uid() != sender_id AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.participant_1_id = auth.uid() OR conversations.participant_2_id = auth.uid())
    )
  );
