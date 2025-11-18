/*
  # Restrict Module Visibility to Community Members Only

  1. Changes
    - Update community_modules SELECT policy to ONLY allow members to view modules
    - Remove public community access to modules
    - Modules now exist ONLY within their specific community
    
  2. Security
    - Maintains RLS protection
    - Only community members can view modules
    - Non-members cannot see any modules
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view modules in accessible communities" ON community_modules;

-- Create new SELECT policy that restricts modules to members only
CREATE POLICY "Only community members can view modules"
  ON community_modules
  FOR SELECT
  TO authenticated
  USING (
    -- Only allow if user is a member of the community (via course)
    EXISTS (
      SELECT 1 FROM community_courses
      JOIN community_members ON community_members.community_id = community_courses.community_id
      WHERE community_courses.id = community_modules.course_id
      AND community_members.user_id = auth.uid()
    )
  );