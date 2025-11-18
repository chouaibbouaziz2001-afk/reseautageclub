/*
  # Optimize Critical Remaining Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid())
    - Only critical high-traffic tables
    
  2. Tables Updated
    - workshops, community_announcements
    - community_courses (admin policies)
    - cofounder_skills, cofounder_interests
    - cofounder_matches (with correct columns)
    - cofounder_messages
*/

-- Workshops
DROP POLICY IF EXISTS "Community admins can create workshops" ON workshops;
CREATE POLICY "Community admins can create workshops"
  ON workshops FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = workshops.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can delete workshops" ON workshops;
CREATE POLICY "Community admins can delete workshops"
  ON workshops FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = workshops.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can update workshops" ON workshops;
CREATE POLICY "Community admins can update workshops"
  ON workshops FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = workshops.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community members can view workshops" ON workshops;
CREATE POLICY "Community members can view workshops"
  ON workshops FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = workshops.community_id 
      AND user_id = (select auth.uid())
    )
  );

-- Community announcements
DROP POLICY IF EXISTS "Community admins can create announcements" ON community_announcements;
CREATE POLICY "Community admins can create announcements"
  ON community_announcements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_announcements.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can delete announcements" ON community_announcements;
CREATE POLICY "Community admins can delete announcements"
  ON community_announcements FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_announcements.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can update announcements" ON community_announcements;
CREATE POLICY "Community admins can update announcements"
  ON community_announcements FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_announcements.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community members can view announcements" ON community_announcements;
CREATE POLICY "Community members can view announcements"
  ON community_announcements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_announcements.community_id 
      AND user_id = (select auth.uid())
    )
  );

-- Community courses
DROP POLICY IF EXISTS "Community admins can create courses" ON community_courses;
CREATE POLICY "Community admins can create courses"
  ON community_courses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_courses.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can delete courses" ON community_courses;
CREATE POLICY "Community admins can delete courses"
  ON community_courses FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_courses.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community admins can update courses" ON community_courses;
CREATE POLICY "Community admins can update courses"
  ON community_courses FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_courses.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- Cofounder matches (with correct columns)
DROP POLICY IF EXISTS "Users can create match requests" ON cofounder_matches;
CREATE POLICY "Users can create match requests"
  ON cofounder_matches FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own match requests" ON cofounder_matches;
CREATE POLICY "Users can delete own match requests"
  ON cofounder_matches FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update received match requests" ON cofounder_matches;
CREATE POLICY "Users can update received match requests"
  ON cofounder_matches FOR UPDATE TO authenticated
  USING (matched_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their match requests" ON cofounder_matches;
CREATE POLICY "Users can view their match requests"
  ON cofounder_matches FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR matched_user_id = (select auth.uid()));

-- Cofounder messages
DROP POLICY IF EXISTS "Users can delete own cofounder messages" ON cofounder_messages;
CREATE POLICY "Users can delete own cofounder messages"
  ON cofounder_messages FOR DELETE TO authenticated
  USING (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can send messages in their matches" ON cofounder_messages;
CREATE POLICY "Users can send messages in their matches"
  ON cofounder_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM cofounder_matches 
      WHERE id = match_id 
      AND status = 'accepted'
      AND (user_id = (select auth.uid()) OR matched_user_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view messages in their matches" ON cofounder_messages;
CREATE POLICY "Users can view messages in their matches"
  ON cofounder_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_matches 
      WHERE id = cofounder_messages.match_id 
      AND (user_id = (select auth.uid()) OR matched_user_id = (select auth.uid()))
    )
  );

-- Cofounder skills
DROP POLICY IF EXISTS "Users can manage own skills" ON cofounder_skills;
CREATE POLICY "Users can manage own skills"
  ON cofounder_skills FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles 
      WHERE cofounder_profiles.id = cofounder_skills.profile_id 
      AND cofounder_profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view skills of active profiles" ON cofounder_skills;
CREATE POLICY "Users can view skills of active profiles"
  ON cofounder_skills FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles 
      WHERE cofounder_profiles.id = cofounder_skills.profile_id 
      AND cofounder_profiles.looking_for_cofounder = true
    )
  );

-- Cofounder interests
DROP POLICY IF EXISTS "Users can manage own interests" ON cofounder_interests;
CREATE POLICY "Users can manage own interests"
  ON cofounder_interests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles 
      WHERE cofounder_profiles.id = cofounder_interests.profile_id 
      AND cofounder_profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can view interests of active profiles" ON cofounder_interests;
CREATE POLICY "Users can view interests of active profiles"
  ON cofounder_interests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles 
      WHERE cofounder_profiles.id = cofounder_interests.profile_id 
      AND cofounder_profiles.looking_for_cofounder = true
    )
  );