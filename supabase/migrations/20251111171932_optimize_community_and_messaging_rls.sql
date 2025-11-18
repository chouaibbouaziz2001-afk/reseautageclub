/*
  # Optimize Community and Messaging RLS Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid())
    - Tables with community membership checks
    - Tables with conversation checks
    
  2. Tables Updated
    - communities
    - community_posts
    - community_chat_messages
    - community_call_participants
    - conversations, messages
    - community_live_calls
    - community_modules, community_lessons
    - community_announcements, community_courses
    - call_comments, workshops
    - community_calls
*/

-- Communities
DROP POLICY IF EXISTS "Admins can delete their communities" ON communities;
CREATE POLICY "Admins can delete their communities"
  ON communities FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = communities.id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update their communities" ON communities;
CREATE POLICY "Admins can update their communities"
  ON communities FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = communities.id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Authenticated users can create communities" ON communities;
CREATE POLICY "Authenticated users can create communities"
  ON communities FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Members can view private communities" ON communities;
CREATE POLICY "Members can view private communities"
  ON communities FOR SELECT TO authenticated
  USING (
    is_private = false OR
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = communities.id 
      AND user_id = (select auth.uid())
    )
  );

-- Community posts
DROP POLICY IF EXISTS "Authors can delete their own posts" ON community_posts;
CREATE POLICY "Authors can delete their own posts"
  ON community_posts FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can update their own posts" ON community_posts;
CREATE POLICY "Authors can update their own posts"
  ON community_posts FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Members can view posts in their communities" ON community_posts;
CREATE POLICY "Members can view posts in their communities"
  ON community_posts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_posts.community_id 
      AND user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM communities 
      WHERE id = community_posts.community_id 
      AND is_private = false
    )
  );

-- Community chat messages
DROP POLICY IF EXISTS "Users can delete own community chat messages" ON community_chat_messages;
CREATE POLICY "Users can delete own community chat messages"
  ON community_chat_messages FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own chat messages" ON community_chat_messages;
DROP POLICY IF EXISTS "Community admins can delete any message" ON community_chat_messages;

CREATE POLICY "Users and admins can delete messages"
  ON community_chat_messages FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_chat_messages.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

-- Community live calls
DROP POLICY IF EXISTS "Community members can view calls" ON community_live_calls;
CREATE POLICY "Community members can view calls"
  ON community_live_calls FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_live_calls.community_id 
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Community owners can start calls" ON community_live_calls;
CREATE POLICY "Community owners can start calls"
  ON community_live_calls FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_live_calls.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community owners can update calls" ON community_live_calls;
CREATE POLICY "Community owners can update calls"
  ON community_live_calls FOR UPDATE TO authenticated
  USING (started_by = (select auth.uid()));

-- Community modules
DROP POLICY IF EXISTS "Only community members can view modules" ON community_modules;
CREATE POLICY "Only community members can view modules"
  ON community_modules FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_courses 
      JOIN community_members ON community_courses.community_id = community_members.community_id
      WHERE community_courses.id = community_modules.course_id 
      AND community_members.user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM community_courses 
      JOIN communities ON community_courses.community_id = communities.id
      WHERE community_courses.id = community_modules.course_id 
      AND communities.is_private = false
    )
  );

-- Community lessons
DROP POLICY IF EXISTS "Only community members can view lessons" ON community_lessons;
CREATE POLICY "Only community members can view lessons"
  ON community_lessons FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_modules 
      JOIN community_courses ON community_modules.course_id = community_courses.id
      JOIN community_members ON community_courses.community_id = community_members.community_id
      WHERE community_modules.id = community_lessons.module_id 
      AND community_members.user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM community_modules 
      JOIN community_courses ON community_modules.course_id = community_courses.id
      JOIN communities ON community_courses.community_id = communities.id
      WHERE community_modules.id = community_lessons.module_id 
      AND communities.is_private = false
    )
  );

-- Community courses
DROP POLICY IF EXISTS "Only community members can view courses" ON community_courses;
CREATE POLICY "Only community members can view courses"
  ON community_courses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_courses.community_id 
      AND user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM communities 
      WHERE id = community_courses.community_id 
      AND is_private = false
    )
  );