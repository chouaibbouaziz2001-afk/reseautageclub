-- Community and Event Calls System
-- Creates tables for community admin calls and event organizer calls
-- Includes participant tracking and proper RLS policies

-- Community Calls Table
CREATE TABLE community_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('video', 'audio')) DEFAULT 'video',
  status text NOT NULL CHECK (status IN ('active', 'ended')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_community_calls_community ON community_calls(community_id);
CREATE INDEX idx_community_calls_status ON community_calls(status);
CREATE INDEX idx_community_calls_started_by ON community_calls(started_by);

-- Event Calls Table
CREATE TABLE event_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  started_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type text NOT NULL CHECK (call_type IN ('video', 'audio')) DEFAULT 'video',
  status text NOT NULL CHECK (status IN ('active', 'ended')) DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_event_calls_event ON event_calls(event_id);
CREATE INDEX idx_event_calls_status ON event_calls(status);
CREATE INDEX idx_event_calls_started_by ON event_calls(started_by);

-- Call Participants Table (tracks who joined community or event calls)
CREATE TABLE call_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('community', 'event')),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  left_at timestamptz
);

CREATE INDEX idx_call_participants_call ON call_participants(call_id, call_type);
CREATE INDEX idx_call_participants_user ON call_participants(user_id);

-- Enable RLS
ALTER TABLE community_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for community_calls
CREATE POLICY "Community members can view community calls"
  ON community_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_calls.community_id
        AND community_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Community admins can create calls"
  ON community_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_id
        AND communities.creator_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Community admins can update their calls"
  ON community_calls FOR UPDATE
  TO authenticated
  USING (started_by = (SELECT auth.uid()));

-- RLS Policies for event_calls
CREATE POLICY "Event attendees can view event calls"
  ON event_calls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_attendees
      WHERE event_attendees.event_id = event_calls.event_id
        AND event_attendees.user_id = (SELECT auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_calls.event_id
        AND events.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Event organizers can create calls"
  ON event_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_id
        AND events.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Event organizers can update their calls"
  ON event_calls FOR UPDATE
  TO authenticated
  USING (started_by = (SELECT auth.uid()));

-- RLS Policies for call_participants
CREATE POLICY "Users can view participants of calls they joined"
  ON call_participants FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR
    EXISTS (
      SELECT 1 FROM call_participants cp2
      WHERE cp2.call_id = call_participants.call_id
        AND cp2.call_type = call_participants.call_type
        AND cp2.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert their own participation"
  ON call_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own participation"
  ON call_participants FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Enable Realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE community_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE event_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE call_participants;