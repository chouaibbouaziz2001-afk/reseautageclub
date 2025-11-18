/*
  # Add Call Comments/Q&A System

  1. Changes
    - Add `comments_enabled` field to `community_calls` table (default true)
    - Create `call_comments` table for member questions during calls
    - Add support for replies to comments (threaded discussions)
    
  2. New Tables
    - `call_comments`
      - `id` (uuid, primary key)
      - `call_id` (uuid, foreign key to community_calls)
      - `user_id` (uuid, foreign key to auth.users)
      - `parent_id` (uuid, nullable, for replies)
      - `content` (text, the question/reply)
      - `is_pinned` (boolean, admin can pin important questions)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
  
  3. Security
    - Enable RLS on `call_comments` table
    - Members can view comments if they're in the community
    - Members can create comments when comments are enabled
    - Only admins can pin/unpin comments
    - Only comment author or admin can delete comments
*/

-- Add comments_enabled field to community_calls
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'comments_enabled'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN comments_enabled boolean DEFAULT true;
  END IF;
END $$;

-- Create call_comments table
CREATE TABLE IF NOT EXISTS call_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES community_calls(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES call_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_pinned boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE call_comments ENABLE ROW LEVEL SECURITY;

-- Members can view comments if they're in the community
CREATE POLICY "Community members can view call comments"
  ON call_comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_calls cc
      JOIN community_members cm ON cm.community_id = cc.community_id
      WHERE cc.id = call_comments.call_id
      AND cm.user_id = auth.uid()
    )
  );

-- Members can create comments when comments are enabled
CREATE POLICY "Community members can create comments when enabled"
  ON call_comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM community_calls cc
      JOIN community_members cm ON cm.community_id = cc.community_id
      WHERE cc.id = call_comments.call_id
      AND cm.user_id = auth.uid()
      AND cc.comments_enabled = true
    )
  );

-- Comment author or admin can update comments (for pinning)
CREATE POLICY "Comment author or admin can update comments"
  ON call_comments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM community_calls cc
      JOIN community_members cm ON cm.community_id = cc.community_id
      WHERE cc.id = call_comments.call_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM community_calls cc
      JOIN community_members cm ON cm.community_id = cc.community_id
      WHERE cc.id = call_comments.call_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- Comment author or admin can delete comments
CREATE POLICY "Comment author or admin can delete comments"
  ON call_comments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM community_calls cc
      JOIN community_members cm ON cm.community_id = cc.community_id
      WHERE cc.id = call_comments.call_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_comments_call_id ON call_comments(call_id);
CREATE INDEX IF NOT EXISTS idx_call_comments_parent_id ON call_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_call_comments_user_id ON call_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_call_comments_created_at ON call_comments(created_at);
