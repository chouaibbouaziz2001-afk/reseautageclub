/*
  # Restrict Lesson Visibility to Community Members Only

  1. Changes
    - Update community_lessons SELECT policy to ONLY allow members to view lessons
    - Remove public community access to lessons
    - Lessons now exist ONLY within their specific community
    
  2. Security
    - Maintains RLS protection
    - Only community members can view lessons
    - Non-members cannot see any lessons
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view lessons in accessible communities" ON community_lessons;

-- Create new SELECT policy that restricts lessons to members only
CREATE POLICY "Only community members can view lessons"
  ON community_lessons
  FOR SELECT
  TO authenticated
  USING (
    -- Only allow if user is a member of the community (via module -> course)
    EXISTS (
      SELECT 1 FROM community_modules
      JOIN community_courses ON community_courses.id = community_modules.course_id
      JOIN community_members ON community_members.community_id = community_courses.community_id
      WHERE community_modules.id = community_lessons.module_id
      AND community_members.user_id = auth.uid()
    )
  );