/*
  # Community Live Calls System
  
  1. New Tables
    - `community_live_calls`
      - `id` (uuid, primary key)
      - `community_id` (uuid, references communities)
      - `started_by` (uuid, references profiles)
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz, nullable)
      - `is_active` (boolean)
      - `room_id` (text, unique identifier for the call)
    
    - `live_call_participants`
      - `id` (uuid, primary key)
      - `call_id` (uuid, references community_live_calls)
      - `user_id` (uuid, references profiles)
      - `joined_at` (timestamptz)
      - `left_at` (timestamptz, nullable)
      - `hand_raised` (boolean, default false)
      - `hand_raised_at` (timestamptz, nullable)
  
  2. Security
    - Enable RLS on both tables
    - Community members can view active calls
    - Community owners can start/end calls
    - Participants can update their own hand raise status
  
  3. Important Notes
    - Only one active call per community at a time
    - Hand raise functionality similar to Google Meet
    - Track participant join/leave times for analytics
*/

-- Create community_live_calls table
CREATE TABLE IF NOT EXISTS community_live_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  started_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now() NOT NULL,
  ended_at timestamptz,
  is_active boolean DEFAULT true NOT NULL,
  room_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_community_live_calls_community_id ON community_live_calls(community_id);
CREATE INDEX IF NOT EXISTS idx_community_live_calls_is_active ON community_live_calls(is_active);

-- Create live_call_participants table
CREATE TABLE IF NOT EXISTS live_call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES community_live_calls(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  left_at timestamptz,
  hand_raised boolean DEFAULT false NOT NULL,
  hand_raised_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(call_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_live_call_participants_call_id ON live_call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_live_call_participants_user_id ON live_call_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_live_call_participants_hand_raised ON live_call_participants(hand_raised);

-- Enable RLS
ALTER TABLE community_live_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_call_participants ENABLE ROW LEVEL SECURITY;

-- Policies for community_live_calls

-- Community members can view calls in their communities
CREATE POLICY "Community members can view calls"
  ON community_live_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_live_calls.community_id
      AND community_members.user_id = auth.uid()
    )
  );

-- Community owners can insert calls
CREATE POLICY "Community owners can start calls"
  ON community_live_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_id
      AND communities.creator_id = auth.uid()
    )
  );

-- Community owners can update their calls
CREATE POLICY "Community owners can update calls"
  ON community_live_calls FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_id
      AND communities.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_id
      AND communities.creator_id = auth.uid()
    )
  );

-- Policies for live_call_participants

-- Users can view participants in calls they have access to
CREATE POLICY "Users can view call participants"
  ON live_call_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_live_calls clc
      JOIN community_members cm ON cm.community_id = clc.community_id
      WHERE clc.id = live_call_participants.call_id
      AND cm.user_id = auth.uid()
    )
  );

-- Users can insert themselves as participants
CREATE POLICY "Users can join calls"
  ON live_call_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM community_live_calls clc
      JOIN community_members cm ON cm.community_id = clc.community_id
      WHERE clc.id = call_id
      AND cm.user_id = auth.uid()
      AND clc.is_active = true
    )
  );

-- Users can update their own participation (hand raise, leave time)
CREATE POLICY "Users can update their own participation"
  ON live_call_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to ensure only one active call per community
CREATE OR REPLACE FUNCTION check_single_active_call()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_active = true THEN
    IF EXISTS (
      SELECT 1 FROM community_live_calls
      WHERE community_id = NEW.community_id
      AND is_active = true
      AND id != NEW.id
    ) THEN
      RAISE EXCEPTION 'A live call is already active for this community';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS ensure_single_active_call ON community_live_calls;
CREATE TRIGGER ensure_single_active_call
  BEFORE INSERT OR UPDATE ON community_live_calls
  FOR EACH ROW
  EXECUTE FUNCTION check_single_active_call();