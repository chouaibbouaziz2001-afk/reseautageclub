/*
  # Optimize Last Remaining RLS Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in final policies
    - Complete all RLS optimizations
    
  2. Tables Updated
    - conversations
    - messages
    - community_chat_messages (remaining policies)
    - community_posts (remaining policies)
    - community_call_participants
    - live_call_participants
    - community_modules
    - community_lessons
    - call_comments
    - community_calls
*/

-- Conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
CREATE POLICY "Users can update their conversations"
  ON conversations FOR UPDATE TO authenticated
  USING (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT TO authenticated
  USING (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()));

-- Messages
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages"
  ON messages FOR DELETE TO authenticated
  USING (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can mark received messages as read" ON messages;
CREATE POLICY "Users can mark received messages as read"
  ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = conversation_id 
      AND (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE id = messages.conversation_id 
      AND (participant_1_id = (select auth.uid()) OR participant_2_id = (select auth.uid()))
    )
  );

-- Community chat messages (remaining policies)
DROP POLICY IF EXISTS "Members can send chat messages in their communities" ON community_chat_messages;
CREATE POLICY "Members can send chat messages in their communities"
  ON community_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_chat_messages.community_id 
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can view chat messages in their communities" ON community_chat_messages;
CREATE POLICY "Members can view chat messages in their communities"
  ON community_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_chat_messages.community_id 
      AND user_id = (select auth.uid())
    )
  );

-- Community posts (remaining policies)
DROP POLICY IF EXISTS "Members can create posts in their communities" ON community_posts;
CREATE POLICY "Members can create posts in their communities"
  ON community_posts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_posts.community_id 
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can create posts with channel restrictions" ON community_posts;
CREATE POLICY "Members can create posts with channel restrictions"
  ON community_posts FOR INSERT TO authenticated
  WITH CHECK (
    author_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_posts.community_id 
      AND user_id = (select auth.uid())
    )
  );

-- Community call participants
DROP POLICY IF EXISTS "Members can join calls in their communities" ON community_call_participants;
CREATE POLICY "Members can join calls in their communities"
  ON community_call_participants FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM community_calls
      JOIN community_members ON community_calls.community_id = community_members.community_id
      WHERE community_calls.id = call_id
      AND community_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Members can view call participants" ON community_call_participants;
CREATE POLICY "Members can view call participants"
  ON community_call_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_calls
      JOIN community_members ON community_calls.community_id = community_members.community_id
      WHERE community_calls.id = community_call_participants.call_id
      AND community_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can leave calls" ON community_call_participants;
CREATE POLICY "Users can leave calls"
  ON community_call_participants FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Live call participants
DROP POLICY IF EXISTS "Users can view call participants" ON live_call_participants;
CREATE POLICY "Users can view call participants"
  ON live_call_participants FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_live_calls
      JOIN community_members ON community_live_calls.community_id = community_members.community_id
      WHERE community_live_calls.id = live_call_participants.call_id
      AND community_members.user_id = (select auth.uid())
    )
  );

-- Community modules
DROP POLICY IF EXISTS "Community admins can manage modules" ON community_modules;
CREATE POLICY "Community admins can manage modules"
  ON community_modules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_courses 
      JOIN community_members ON community_courses.community_id = community_members.community_id
      WHERE community_courses.id = community_modules.course_id 
      AND community_members.user_id = (select auth.uid())
      AND community_members.role = 'admin'
    )
  );

-- Community lessons
DROP POLICY IF EXISTS "Community admins can manage lessons" ON community_lessons;
CREATE POLICY "Community admins can manage lessons"
  ON community_lessons FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_modules 
      JOIN community_courses ON community_modules.course_id = community_courses.id
      JOIN community_members ON community_courses.community_id = community_members.community_id
      WHERE community_modules.id = community_lessons.module_id 
      AND community_members.user_id = (select auth.uid())
      AND community_members.role = 'admin'
    )
  );

-- Call comments
DROP POLICY IF EXISTS "Comment author or admin can delete comments" ON call_comments;
CREATE POLICY "Comment author or admin can delete comments"
  ON call_comments FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM community_live_calls
      JOIN community_members ON community_live_calls.community_id = community_members.community_id
      WHERE community_live_calls.id = call_comments.call_id
      AND community_members.user_id = (select auth.uid())
      AND community_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Comment author or admin can update comments" ON call_comments;
CREATE POLICY "Comment author or admin can update comments"
  ON call_comments FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM community_live_calls
      JOIN community_members ON community_live_calls.community_id = community_members.community_id
      WHERE community_live_calls.id = call_comments.call_id
      AND community_members.user_id = (select auth.uid())
      AND community_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Community members can create comments when enabled" ON call_comments;
CREATE POLICY "Community members can create comments when enabled"
  ON call_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM community_live_calls
      JOIN community_members ON community_live_calls.community_id = community_members.community_id
      WHERE community_live_calls.id = call_id
      AND community_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Community members can view call comments" ON call_comments;
CREATE POLICY "Community members can view call comments"
  ON call_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_live_calls
      JOIN community_members ON community_live_calls.community_id = community_members.community_id
      WHERE community_live_calls.id = call_comments.call_id
      AND community_members.user_id = (select auth.uid())
    )
  );

-- Community calls
DROP POLICY IF EXISTS "Members can view calls in their communities" ON community_calls;
CREATE POLICY "Members can view calls in their communities"
  ON community_calls FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_calls.community_id 
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Only admins can create calls" ON community_calls;
CREATE POLICY "Only admins can create calls"
  ON community_calls FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members 
      WHERE community_id = community_calls.community_id 
      AND user_id = (select auth.uid()) 
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Only call creators can update calls" ON community_calls;
CREATE POLICY "Only call creators can update calls"
  ON community_calls FOR UPDATE TO authenticated
  USING (creator_id = (select auth.uid()));