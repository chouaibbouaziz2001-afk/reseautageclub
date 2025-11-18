/*
  # Fix Course Visibility for Public Communities

  1. Changes
    - Update community_courses SELECT policy to allow viewing courses in public communities
    - Previous: Only community members could view courses
    - New: Anyone can view courses in public communities, only members can view courses in private communities
    
  2. Security
    - Maintains RLS protection
    - Private community courses remain restricted to members only
    - Public community courses are viewable by all authenticated users
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Community members can view courses" ON community_courses;

-- Create new SELECT policy that allows viewing courses based on community privacy
CREATE POLICY "Users can view courses in accessible communities"
  ON community_courses
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if community is public OR user is a member
    EXISTS (
      SELECT 1 FROM communities
      WHERE communities.id = community_courses.community_id
      AND (
        communities.is_private = false
        OR EXISTS (
          SELECT 1 FROM community_members
          WHERE community_members.community_id = communities.id
          AND community_members.user_id = auth.uid()
        )
      )
    )
  );