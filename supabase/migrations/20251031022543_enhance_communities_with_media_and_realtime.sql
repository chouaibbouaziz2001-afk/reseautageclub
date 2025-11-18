/*
  # Enhance Communities with Media, Calls, and Chatroom

  This migration adds advanced features to communities including video calls, live streams, chatroom, and media posts.

  ## 1. New Tables
    
    ### `community_chat_messages`
    - `id` (uuid, primary key) - Unique identifier for chat message
    - `community_id` (uuid) - Reference to the community
    - `user_id` (uuid) - User who sent the message
    - `content` (text) - Message content
    - `created_at` (timestamptz) - When the message was sent
    - Real-time chatroom for community members
    
    ### `community_calls`
    - `id` (uuid, primary key) - Unique identifier for the call
    - `community_id` (uuid) - Reference to the community
    - `creator_id` (uuid) - User who started the call
    - `title` (text) - Call title
    - `type` (text) - Call type: 'video_call', 'live_stream'
    - `status` (text) - Call status: 'scheduled', 'active', 'ended'
    - `room_id` (text) - Unique room identifier for video service
    - `scheduled_at` (timestamptz) - When the call is scheduled
    - `started_at` (timestamptz) - When the call started
    - `ended_at` (timestamptz) - When the call ended
    - `created_at` (timestamptz) - When the call was created
    
    ### `community_call_participants`
    - `id` (uuid, primary key) - Unique identifier
    - `call_id` (uuid) - Reference to the call
    - `user_id` (uuid) - Participant user
    - `joined_at` (timestamptz) - When they joined
    - Tracks who joins calls/streams

  ## 2. Table Modifications
    
    ### `community_posts`
    - Add `media_type` (text) - Type of media: 'text', 'image', 'video'
    - Add `video_url` (text) - URL for video posts
    
  ## 3. Security
    
    ### Community Chat Messages RLS Policies
    - Enable RLS on `community_chat_messages` table
    - Members can view messages in their communities
    - Members can create messages in their communities
    - Users can delete their own messages
    
    ### Community Calls RLS Policies
    - Enable RLS on `community_calls` table
    - Members can view calls in their communities
    - Only admins (creators) can create calls
    - Only call creators can update/end calls
    
    ### Community Call Participants RLS Policies
    - Enable RLS on `community_call_participants` table
    - Members can view participants in calls they're in
    - Users can join calls in their communities
    - Users can leave calls (delete their participation)

  ## 4. Important Notes
    - Only community creators (admins) can start video calls and live streams
    - All community members can participate in chatroom
    - All members can join calls/streams started by creators
    - Media posts support images and videos
    - Room IDs are generated for video services integration
*/

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'video_call',
  status text NOT NULL DEFAULT 'scheduled',
  room_id text NOT NULL UNIQUE,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT community_calls_type_check CHECK (type IN ('video_call', 'live_stream')),
  CONSTRAINT community_calls_status_check CHECK (status IN ('scheduled', 'active', 'ended'))
);

CREATE TABLE IF NOT EXISTS community_call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES community_calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT community_call_participants_unique UNIQUE (call_id, user_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN media_type text DEFAULT 'text';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'video_url'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN video_url text;
  END IF;
END $$;

ALTER TABLE community_posts ADD CONSTRAINT community_posts_media_type_check 
  CHECK (media_type IN ('text', 'image', 'video'));

CREATE INDEX IF NOT EXISTS idx_community_chat_messages_community ON community_chat_messages(community_id);
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_created_at ON community_chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_calls_community ON community_calls(community_id);
CREATE INDEX IF NOT EXISTS idx_community_calls_status ON community_calls(status);
CREATE INDEX IF NOT EXISTS idx_community_calls_creator ON community_calls(creator_id);
CREATE INDEX IF NOT EXISTS idx_community_call_participants_call ON community_call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_community_call_participants_user ON community_call_participants(user_id);

ALTER TABLE community_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_call_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chat messages in their communities"
  ON community_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_chat_messages.community_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send chat messages in their communities"
  ON community_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_chat_messages.community_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own chat messages"
  ON community_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view calls in their communities"
  ON community_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_calls.community_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can create calls"
  ON community_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creator_id AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_calls.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role = 'admin'
    )
  );

CREATE POLICY "Only call creators can update calls"
  ON community_calls FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Members can view call participants"
  ON community_call_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_calls
      JOIN community_members ON community_members.community_id = community_calls.community_id
      WHERE community_calls.id = community_call_participants.call_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can join calls in their communities"
  ON community_call_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM community_calls
      JOIN community_members ON community_members.community_id = community_calls.community_id
      WHERE community_calls.id = call_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can leave calls"
  ON community_call_participants FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
