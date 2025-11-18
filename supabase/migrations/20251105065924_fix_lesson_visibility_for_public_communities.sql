/*
  # Fix Lesson Visibility for Public Communities

  1. Changes
    - Update community_lessons SELECT policy to allow viewing lessons in public communities
    - Previous: Only community members could view lessons
    - New: Anyone can view lessons in public communities, only members can view lessons in private communities
    
  2. Security
    - Maintains RLS protection
    - Private community lessons remain restricted to members only
    - Public community lessons are viewable by all authenticated users
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Community members can view lessons" ON community_lessons;

-- Create new SELECT policy that allows viewing lessons based on community privacy
CREATE POLICY "Users can view lessons in accessible communities"
  ON community_lessons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM community_modules cm
      JOIN community_courses cc ON cc.id = cm.course_id
      JOIN communities c ON c.id = cc.community_id
      WHERE cm.id = community_lessons.module_id
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