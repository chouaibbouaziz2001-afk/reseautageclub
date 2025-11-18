/*
  # Fix Module Visibility for Public Communities

  1. Changes
    - Update community_modules SELECT policy to allow viewing modules in public communities
    - Previous: Only community members could view modules
    - New: Anyone can view modules in public communities, only members can view modules in private communities
    
  2. Security
    - Maintains RLS protection
    - Private community modules remain restricted to members only
    - Public community modules are viewable by all authenticated users
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Community members can view modules" ON community_modules;

-- Create new SELECT policy that allows viewing modules based on community privacy
CREATE POLICY "Users can view modules in accessible communities"
  ON community_modules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM community_courses cc
      JOIN communities c ON c.id = cc.community_id
      WHERE cc.id = community_modules.course_id
      AND (
        c.is_private = false
        OR EXISTS (
          SELECT 1 FROM community_members
          WHERE community_members.community_id = c.id
          AND community_members.user_id = auth.uid()
        )
      )
    )
  );