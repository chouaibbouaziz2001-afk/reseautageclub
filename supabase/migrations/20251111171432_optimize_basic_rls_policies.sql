/*
  # Optimize Basic RLS Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid())
    - Focus on tables with simple direct ownership
    - Improves query performance significantly

  2. Tables Updated
    - posts
    - profiles  
    - community_members
    - cofounder_profiles
    - notifications
    - blocked_users
    - user_rooms
    - event_attendees
    - followers
    - membership_plans
*/

-- Posts
DROP POLICY IF EXISTS "Authenticated users can create posts" ON posts;
CREATE POLICY "Authenticated users can create posts"
  ON posts FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE TO authenticated
  USING (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE TO authenticated
  USING (author_id = (select auth.uid()));

-- Profiles
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
CREATE POLICY "Users can delete their own profile"
  ON profiles FOR DELETE TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (id = (select auth.uid()));

-- Community members
DROP POLICY IF EXISTS "Users can join communities" ON community_members;
CREATE POLICY "Users can join communities"
  ON community_members FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can leave communities" ON community_members;
CREATE POLICY "Users can leave communities"
  ON community_members FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- Cofounder profiles
DROP POLICY IF EXISTS "Users can create own profile" ON cofounder_profiles;
CREATE POLICY "Users can create own profile"
  ON cofounder_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profile" ON cofounder_profiles;
CREATE POLICY "Users can delete own profile"
  ON cofounder_profiles FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON cofounder_profiles;
CREATE POLICY "Users can update own profile"
  ON cofounder_profiles FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON cofounder_profiles;
CREATE POLICY "Users can view own profile"
  ON cofounder_profiles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Notifications
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- Blocked users
DROP POLICY IF EXISTS "Users can block other users" ON blocked_users;
CREATE POLICY "Users can block other users"
  ON blocked_users FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unblock users" ON blocked_users;
CREATE POLICY "Users can unblock users"
  ON blocked_users FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own blocked list" ON blocked_users;
CREATE POLICY "Users can view their own blocked list"
  ON blocked_users FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- User rooms
DROP POLICY IF EXISTS "Users can create own room" ON user_rooms;
CREATE POLICY "Users can create own room"
  ON user_rooms FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own room" ON user_rooms;
CREATE POLICY "Users can update own room"
  ON user_rooms FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

-- Event attendees
DROP POLICY IF EXISTS "Users can register for events" ON event_attendees;
CREATE POLICY "Users can register for events"
  ON event_attendees FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own registration" ON event_attendees;
CREATE POLICY "Users can update own registration"
  ON event_attendees FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

-- Followers
DROP POLICY IF EXISTS "Users can follow others" ON followers;
CREATE POLICY "Users can follow others"
  ON followers FOR INSERT TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can unfollow" ON followers;
CREATE POLICY "Users can unfollow"
  ON followers FOR DELETE TO authenticated
  USING (follower_id = (select auth.uid()));

-- Membership plans
DROP POLICY IF EXISTS "Users can create their own membership" ON membership_plans;
CREATE POLICY "Users can create their own membership"
  ON membership_plans FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own membership" ON membership_plans;
CREATE POLICY "Users can update their own membership"
  ON membership_plans FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own membership" ON membership_plans;
CREATE POLICY "Users can view their own membership"
  ON membership_plans FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));