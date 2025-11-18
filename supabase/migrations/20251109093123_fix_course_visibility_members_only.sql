/*
  # Restrict Course Visibility to Community Members Only

  1. Changes
    - Update community_courses SELECT policy to ONLY allow members to view courses
    - Remove public community access to courses
    - Courses now exist ONLY within their specific community
    
  2. Security
    - Maintains RLS protection
    - Only community members can view courses from that community
    - Non-members cannot see any courses, regardless of community privacy
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view courses in accessible communities" ON community_courses;

-- Create new SELECT policy that restricts courses to members only
CREATE POLICY "Only community members can view courses"
  ON community_courses
  FOR SELECT
  TO authenticated
  USING (
    -- Only allow if user is a member of the community
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_courses.community_id
      AND community_members.user_id = auth.uid()
    )
  );