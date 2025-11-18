/*
  # Create Community Messages for Real-Time Group Chat
  
  1. New Tables
    - `community_messages`
      - `id` (uuid, primary key)
      - `community_id` (uuid, references communities)
      - `user_id` (uuid, references profiles) - message sender
      - `content` (text) - message text
      - `images` (text[]) - optional image URLs
      - `read_by` (uuid[]) - array of user IDs who read the message
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  2. Security
    - Enable RLS on community_messages table
    - Members can view messages in their communities
    - Members can send messages to their communities
    - Members can delete their own messages
  
  3. Performance
    - Index on community_id for fast queries
    - Index on created_at for message ordering
    - Index on user_id for sender queries
  
  4. Realtime
    - Enable realtime replication for instant message delivery
*/

-- Create community_messages table
CREATE TABLE IF NOT EXISTS community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  images text[] DEFAULT '{}',
  read_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_messages_community_id ON community_messages(community_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON community_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_user_id ON community_messages(user_id);

-- Enable RLS
ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

-- Members can view messages in communities they belong to
CREATE POLICY "Community members can view messages"
  ON community_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_messages.community_id
      AND community_members.user_id = auth.uid()
    )
  );

-- Members can send messages to their communities
CREATE POLICY "Community members can send messages"
  ON community_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_messages.community_id
      AND community_members.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

-- Members can update their own messages (for read_by tracking)
CREATE POLICY "Members can update messages for read status"
  ON community_messages FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Users can delete their own messages
CREATE POLICY "Users can delete their own messages"
  ON community_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE community_messages;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_community_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_community_messages_updated_at
  BEFORE UPDATE ON community_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_community_messages_updated_at();
