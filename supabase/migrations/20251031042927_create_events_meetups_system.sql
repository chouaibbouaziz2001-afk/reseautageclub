/*
  # Events & Meetups System with User Rooms

  1. New Tables
    - `user_rooms`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - room owner
      - `name` (text) - room name
      - `description` (text)
      - `avatar_url` (text)
      - `created_at` (timestamptz)

    - `events`
      - `id` (uuid, primary key)
      - `room_id` (uuid, references user_rooms)
      - `title` (text)
      - `description` (text)
      - `event_type` (text) - virtual, in-person
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `location` (text) - for in-person events
      - `meeting_url` (text) - for virtual events
      - `max_attendees` (integer)
      - `cover_image_url` (text)
      - `created_by` (uuid, references auth.users)
      - `created_at` (timestamptz)

    - `event_attendees`
      - `id` (uuid, primary key)
      - `event_id` (uuid, references events)
      - `user_id` (uuid, references auth.users)
      - `status` (text) - registered, attended, cancelled
      - `registered_at` (timestamptz)

    - `room_announcements`
      - `id` (uuid, primary key)
      - `room_id` (uuid, references user_rooms)
      - `created_by` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamptz)

    - `room_admins`
      - `id` (uuid, primary key)
      - `room_id` (uuid, references user_rooms)
      - `user_id` (uuid, references auth.users)
      - `can_make_calls` (boolean)
      - `can_make_announcements` (boolean)
      - `granted_by` (uuid, references auth.users)
      - `granted_at` (timestamptz)

    - `live_streams`
      - `id` (uuid, primary key)
      - `room_id` (uuid, references user_rooms)
      - `title` (text)
      - `description` (text)
      - `started_by` (uuid, references auth.users)
      - `status` (text) - live, ended
      - `started_at` (timestamptz)
      - `ended_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view public rooms and events
    - Only room owners and admins can create events/announcements
    - Only authorized admins can start calls/streams
*/

CREATE TABLE IF NOT EXISTS user_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES user_rooms NOT NULL,
  title text NOT NULL,
  description text,
  event_type text NOT NULL DEFAULT 'virtual',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  meeting_url text,
  max_attendees integer,
  cover_image_url text,
  created_by uuid REFERENCES auth.users NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  status text DEFAULT 'registered',
  registered_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS room_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES user_rooms NOT NULL,
  created_by uuid REFERENCES auth.users NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS room_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES user_rooms NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  can_make_calls boolean DEFAULT false,
  can_make_announcements boolean DEFAULT false,
  granted_by uuid REFERENCES auth.users NOT NULL,
  granted_at timestamptz DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE TABLE IF NOT EXISTS live_streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES user_rooms NOT NULL,
  title text NOT NULL,
  description text,
  started_by uuid REFERENCES auth.users NOT NULL,
  status text DEFAULT 'live',
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

ALTER TABLE user_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rooms"
  ON user_rooms
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own room"
  ON user_rooms
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own room"
  ON user_rooms
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Room owners and admins can create events"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (
        SELECT 1 FROM user_rooms
        WHERE user_rooms.id = room_id
        AND user_rooms.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM room_admins
        WHERE room_admins.room_id = events.room_id
        AND room_admins.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Room owners and admins can update events"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_rooms
      WHERE user_rooms.id = room_id
      AND user_rooms.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM room_admins
      WHERE room_admins.room_id = events.room_id
      AND room_admins.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view attendees"
  ON event_attendees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can register for events"
  ON event_attendees
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own registration"
  ON event_attendees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view announcements"
  ON room_announcements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Room owners and authorized admins can create announcements"
  ON room_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      EXISTS (
        SELECT 1 FROM user_rooms
        WHERE user_rooms.id = room_id
        AND user_rooms.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM room_admins
        WHERE room_admins.room_id = room_announcements.room_id
        AND room_admins.user_id = auth.uid()
        AND room_admins.can_make_announcements = true
      )
    )
  );

CREATE POLICY "Room owners can view all admins"
  ON room_admins
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_rooms
      WHERE user_rooms.id = room_id
      AND user_rooms.user_id = auth.uid()
    )
  );

CREATE POLICY "Room owners can manage admins"
  ON room_admins
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_rooms
      WHERE user_rooms.id = room_id
      AND user_rooms.user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view live streams"
  ON live_streams
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Room owners and authorized admins can start streams"
  ON live_streams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = started_by
    AND (
      EXISTS (
        SELECT 1 FROM user_rooms
        WHERE user_rooms.id = room_id
        AND user_rooms.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM room_admins
        WHERE room_admins.room_id = live_streams.room_id
        AND room_admins.user_id = auth.uid()
        AND room_admins.can_make_calls = true
      )
    )
  );

CREATE POLICY "Stream creators can update own streams"
  ON live_streams
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = started_by)
  WITH CHECK (auth.uid() = started_by);

CREATE INDEX IF NOT EXISTS idx_events_room_id ON events(room_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_room_announcements_room_id ON room_announcements(room_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_room_id ON live_streams(room_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);