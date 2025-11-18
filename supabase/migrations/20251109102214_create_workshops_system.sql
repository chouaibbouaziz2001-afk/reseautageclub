/*
  # Create Workshops System

  1. New Tables
    - `workshops`
      - `id` (uuid, primary key)
      - `community_id` (uuid, foreign key to communities)
      - `call_id` (uuid, foreign key to community_calls)
      - `title` (text)
      - `description` (text, nullable)
      - `thumbnail_url` (text, nullable)
      - `video_url` (text, nullable)
      - `duration` (integer, in seconds)
      - `host_id` (uuid, foreign key to auth.users)
      - `recorded_at` (timestamptz)
      - `views` (integer, default 0)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `workshops` table
    - Community members can view workshops
    - Only admins can create/update/delete workshops
    - Track workshop views
*/

-- Create workshops table
CREATE TABLE IF NOT EXISTS workshops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  call_id uuid REFERENCES community_calls(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  video_url text,
  duration integer DEFAULT 0,
  host_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  views integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE workshops ENABLE ROW LEVEL SECURITY;

-- Community members can view workshops from their communities
CREATE POLICY "Community members can view workshops"
  ON workshops
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = workshops.community_id
      AND cm.user_id = auth.uid()
    )
  );

-- Admins can create workshops
CREATE POLICY "Community admins can create workshops"
  ON workshops
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = workshops.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- Admins can update workshops
CREATE POLICY "Community admins can update workshops"
  ON workshops
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = workshops.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = workshops.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- Admins can delete workshops
CREATE POLICY "Community admins can delete workshops"
  ON workshops
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = workshops.community_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workshops_community_id ON workshops(community_id);
CREATE INDEX IF NOT EXISTS idx_workshops_call_id ON workshops(call_id);
CREATE INDEX IF NOT EXISTS idx_workshops_host_id ON workshops(host_id);
CREATE INDEX IF NOT EXISTS idx_workshops_recorded_at ON workshops(recorded_at DESC);

-- Create workshop_views table for tracking who viewed what
CREATE TABLE IF NOT EXISTS workshop_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workshop_id uuid REFERENCES workshops(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(workshop_id, user_id)
);

-- Enable RLS
ALTER TABLE workshop_views ENABLE ROW LEVEL SECURITY;

-- Users can track their own views
CREATE POLICY "Users can track their own workshop views"
  ON workshop_views
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can see their own views
CREATE POLICY "Users can see their own workshop views"
  ON workshop_views
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Create function to increment workshop views
CREATE OR REPLACE FUNCTION increment_workshop_views()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE workshops
  SET views = views + 1
  WHERE id = NEW.workshop_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-increment views
DROP TRIGGER IF EXISTS trigger_increment_workshop_views ON workshop_views;
CREATE TRIGGER trigger_increment_workshop_views
  AFTER INSERT ON workshop_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_workshop_views();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workshop_views_workshop_id ON workshop_views(workshop_id);
CREATE INDEX IF NOT EXISTS idx_workshop_views_user_id ON workshop_views(user_id);
