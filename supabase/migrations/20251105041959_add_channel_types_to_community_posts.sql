/*
  # Add Channel Types to Community Posts

  1. Changes
    - Add `channel_type` column to community_posts
    - Channel types: 'general', 'announcement', 'start-here'
    - Add admin_only restriction for certain channel types
    
  2. Security
    - Update policies to restrict posting in admin-only channels
*/

-- Add channel_type to community_posts
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_posts' AND column_name = 'channel_type'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN channel_type text DEFAULT 'general' CHECK (channel_type IN ('general', 'announcement', 'start-here'));
  END IF;
END $$;

-- Drop existing insert policy for community_posts
DROP POLICY IF EXISTS "Members can create posts" ON community_posts;
DROP POLICY IF EXISTS "Community members can create posts" ON community_posts;
DROP POLICY IF EXISTS "Users can create posts in communities they belong to" ON community_posts;

-- Create new policy that respects admin-only channels
CREATE POLICY "Members can create posts with channel restrictions"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
      AND community_members.user_id = auth.uid()
      AND (
        -- Allow all members in general channel
        community_posts.channel_type = 'general'
        -- Only admins can post in announcement and start-here
        OR (community_posts.channel_type IN ('announcement', 'start-here') AND community_members.role = 'admin')
      )
    )
  );