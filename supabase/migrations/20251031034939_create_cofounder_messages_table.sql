/*
  # Create Co-founder Messages Table

  1. New Table
    - `cofounder_messages`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references cofounder_matches)
      - `sender_id` (uuid, references auth.users)
      - `content` (text) - message text content
      - `media_url` (text) - URL to image/video in storage
      - `media_type` (text) - text, image, video
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Users can read messages from their matches
    - Users can send messages in their matches
*/

CREATE TABLE IF NOT EXISTS cofounder_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES cofounder_matches NOT NULL,
  sender_id uuid REFERENCES auth.users NOT NULL,
  content text,
  media_url text,
  media_type text DEFAULT 'text',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cofounder_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their matches"
  ON cofounder_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_matches
      WHERE cofounder_matches.id = match_id
      AND (cofounder_matches.user_id = auth.uid() OR cofounder_matches.matched_user_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their matches"
  ON cofounder_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM cofounder_matches
      WHERE cofounder_matches.id = match_id
      AND cofounder_matches.status = 'accepted'
      AND (cofounder_matches.user_id = auth.uid() OR cofounder_matches.matched_user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_cofounder_messages_match_id ON cofounder_messages(match_id);
CREATE INDEX IF NOT EXISTS idx_cofounder_messages_created_at ON cofounder_messages(created_at);