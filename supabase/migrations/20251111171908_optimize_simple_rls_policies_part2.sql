/*
  # Optimize Simple RLS Policies - Part 2

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid())
    - Focus on tables without complex joins
    
  2. Tables Updated
    - comments, reactions, validated_ideas
    - connections, follows
    - profile_views
    - live_call_participants
    - post_comments, comment_likes
    - post_mentions, comment_mentions
    - user_lesson_progress
    - user_course_favorites
    - cofounder_call_requests
    - message_call_requests
    - workshop_views
*/

-- Comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments"
  ON comments FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

-- Reactions
DROP POLICY IF EXISTS "Authenticated users can create reactions" ON reactions;
CREATE POLICY "Authenticated users can create reactions"
  ON reactions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own reactions" ON reactions;
CREATE POLICY "Users can delete their own reactions"
  ON reactions FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Validated ideas
DROP POLICY IF EXISTS "Authenticated users can create validated ideas" ON validated_ideas;
CREATE POLICY "Authenticated users can create validated ideas"
  ON validated_ideas FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own validated ideas" ON validated_ideas;
CREATE POLICY "Users can delete their own validated ideas"
  ON validated_ideas FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own validated ideas" ON validated_ideas;
CREATE POLICY "Users can view their own validated ideas"
  ON validated_ideas FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Connections
DROP POLICY IF EXISTS "Users can create connection requests" ON connections;
CREATE POLICY "Users can create connection requests"
  ON connections FOR INSERT TO authenticated
  WITH CHECK (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete sent connection requests" ON connections;
CREATE POLICY "Users can delete sent connection requests"
  ON connections FOR DELETE TO authenticated
  USING (requester_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update received connection requests" ON connections;
CREATE POLICY "Users can update received connection requests"
  ON connections FOR UPDATE TO authenticated
  USING (recipient_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view received connection requests" ON connections;
CREATE POLICY "Users can view received connection requests"
  ON connections FOR SELECT TO authenticated
  USING (recipient_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view sent connection requests" ON connections;
CREATE POLICY "Users can view sent connection requests"
  ON connections FOR SELECT TO authenticated
  USING (requester_id = (select auth.uid()));

-- Follows
DROP POLICY IF EXISTS "Users can create follows" ON follows;
CREATE POLICY "Users can create follows"
  ON follows FOR INSERT TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own follows" ON follows;
CREATE POLICY "Users can delete own follows"
  ON follows FOR DELETE TO authenticated
  USING (follower_id = (select auth.uid()));

-- Profile views
DROP POLICY IF EXISTS "Authenticated users can create profile views" ON profile_views;
CREATE POLICY "Authenticated users can create profile views"
  ON profile_views FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can view their own profile views" ON profile_views;
CREATE POLICY "Users can view their own profile views"
  ON profile_views FOR SELECT TO authenticated
  USING (viewed_profile_id = (select auth.uid()));

-- Live call participants
DROP POLICY IF EXISTS "Users can join calls" ON live_call_participants;
CREATE POLICY "Users can join calls"
  ON live_call_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own participation" ON live_call_participants;
CREATE POLICY "Users can update their own participation"
  ON live_call_participants FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

-- Post comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON post_comments;
CREATE POLICY "Authenticated users can create comments"
  ON post_comments FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;
CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own comments within 5 minutes" ON post_comments;
CREATE POLICY "Users can update own comments within 5 minutes"
  ON post_comments FOR UPDATE TO authenticated
  USING (
    author_id = (select auth.uid()) AND 
    created_at > (now() - interval '5 minutes')
  );

-- Comment likes
DROP POLICY IF EXISTS "Authenticated users can like comments" ON comment_likes;
CREATE POLICY "Authenticated users can like comments"
  ON comment_likes FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can remove their own likes" ON comment_likes;
CREATE POLICY "Users can remove their own likes"
  ON comment_likes FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Post mentions
DROP POLICY IF EXISTS "Authenticated users can create post mentions" ON post_mentions;
CREATE POLICY "Authenticated users can create post mentions"
  ON post_mentions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Comment mentions
DROP POLICY IF EXISTS "Authenticated users can create comment mentions" ON comment_mentions;
CREATE POLICY "Authenticated users can create comment mentions"
  ON comment_mentions FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- User lesson progress
DROP POLICY IF EXISTS "Users can create own progress" ON user_lesson_progress;
CREATE POLICY "Users can create own progress"
  ON user_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own progress" ON user_lesson_progress;
CREATE POLICY "Users can update own progress"
  ON user_lesson_progress FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own progress" ON user_lesson_progress;
CREATE POLICY "Users can view own progress"
  ON user_lesson_progress FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- User course favorites
DROP POLICY IF EXISTS "Users can add own favorites" ON user_course_favorites;
CREATE POLICY "Users can add own favorites"
  ON user_course_favorites FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can remove own favorites" ON user_course_favorites;
CREATE POLICY "Users can remove own favorites"
  ON user_course_favorites FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own favorites" ON user_course_favorites;
CREATE POLICY "Users can view own favorites"
  ON user_course_favorites FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Workshop views
DROP POLICY IF EXISTS "Users can see their own workshop views" ON workshop_views;
CREATE POLICY "Users can see their own workshop views"
  ON workshop_views FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can track their own workshop views" ON workshop_views;
CREATE POLICY "Users can track their own workshop views"
  ON workshop_views FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));