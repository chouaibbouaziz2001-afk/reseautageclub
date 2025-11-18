/*
  # Create Admin System for Events & Meetups

  1. New Tables
    - `event_admins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `is_super_admin` (boolean) - Only super admin can add other admins
      - `added_by` (uuid, references profiles) - Who added this admin
      - `created_at` (timestamptz)
    
    - `admin_chat_messages`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references profiles)
      - `message` (text)
      - `created_at` (timestamptz)

  2. Changes to Events Table
    - Add `is_live` column to track if event is currently live
    - Add `live_started_at` column to track when live started
    - Add `live_started_by` column to track who started the live

  3. Security
    - Enable RLS on all new tables
    - Only super admin can add/remove admins
    - Only admins can create events
    - Only admins can start lives
    - Only admins can access admin chat

  4. Initial Data
    - Set chouaib bouaziz as super admin
*/

-- Create event_admins table
CREATE TABLE IF NOT EXISTS event_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_super_admin boolean DEFAULT false,
  added_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create admin chat messages table
CREATE TABLE IF NOT EXISTS admin_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add columns to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'is_live'
  ) THEN
    ALTER TABLE events ADD COLUMN is_live boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'live_started_at'
  ) THEN
    ALTER TABLE events ADD COLUMN live_started_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'live_started_by'
  ) THEN
    ALTER TABLE events ADD COLUMN live_started_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE event_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for event_admins table
CREATE POLICY "Anyone can view admins"
  ON event_admins FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only super admin can add admins"
  ON event_admins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

CREATE POLICY "Only super admin can remove admins"
  ON event_admins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );

-- Policies for admin_chat_messages
CREATE POLICY "Only admins can view admin chat"
  ON admin_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can send admin chat messages"
  ON admin_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
    )
  );

-- Update events table policies to require admin
DROP POLICY IF EXISTS "Anyone can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;
DROP POLICY IF EXISTS "Event creators can update their events" ON events;
DROP POLICY IF EXISTS "Event creators can delete their events" ON events;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can delete events"
  ON events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
    )
  );

-- Insert chouaib bouaziz as super admin
INSERT INTO event_admins (user_id, is_super_admin, added_by)
VALUES ('c1073e79-9162-4dbf-bfc8-eb3bd4e0baef', true, 'c1073e79-9162-4dbf-bfc8-eb3bd4e0baef')
ON CONFLICT (user_id) DO UPDATE
SET is_super_admin = true;

-- Create function to start a live event (admins only)
CREATE OR REPLACE FUNCTION start_live_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM event_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only admins can start live events';
  END IF;

  -- Update event to live
  UPDATE events
  SET 
    is_live = true,
    live_started_at = now(),
    live_started_by = auth.uid()
  WHERE id = event_id;
END;
$$;

-- Create function to end a live event (admins only)
CREATE OR REPLACE FUNCTION end_live_event(event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM event_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only admins can end live events';
  END IF;

  -- Update event to not live
  UPDATE events
  SET is_live = false
  WHERE id = event_id;
END;
$$;
