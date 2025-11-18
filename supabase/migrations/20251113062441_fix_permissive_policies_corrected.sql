/*
  # Fix Multiple Permissive RLS Policies - Corrected

  1. Security Enhancement
    - Consolidates multiple permissive policies into single policies
    - Prevents potential security gaps from overlapping policy logic
    - Ensures consistent access control across all tables
    
  2. Tables Being Fixed
    - cofounder_interests
    - cofounder_profiles  
    - cofounder_skills
    - communities
    - community_chat_messages
    - community_lessons
    - community_modules
    - community_posts
    - connections
    
  3. Security Notes
    - All policies remain restrictive by default
    - Access is only granted when explicitly needed
*/

-- Fix cofounder_interests
DROP POLICY IF EXISTS "Users can manage own interests" ON cofounder_interests;
DROP POLICY IF EXISTS "Users can view interests of active profiles" ON cofounder_interests;

CREATE POLICY "Users can view and manage cofounder interests"
  ON cofounder_interests FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.user_id = cofounder_interests.profile_id
      AND cofounder_profiles.looking_for_cofounder = true
    )
  );

-- Fix cofounder_profiles
DROP POLICY IF EXISTS "Anyone can view active cofounder profiles" ON cofounder_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON cofounder_profiles;

CREATE POLICY "Users can view cofounder profiles"
  ON cofounder_profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR looking_for_cofounder = true
  );

-- Fix cofounder_skills
DROP POLICY IF EXISTS "Users can manage own skills" ON cofounder_skills;
DROP POLICY IF EXISTS "Users can view skills of active profiles" ON cofounder_skills;

CREATE POLICY "Users can view and manage cofounder skills"
  ON cofounder_skills FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.user_id = cofounder_skills.profile_id
      AND cofounder_profiles.looking_for_cofounder = true
    )
  );

-- Fix communities
DROP POLICY IF EXISTS "Anyone can view public communities" ON communities;
DROP POLICY IF EXISTS "Members can view private communities" ON communities;

CREATE POLICY "Users can view communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    is_private = false
    OR EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = communities.id
      AND community_members.user_id = auth.uid()
    )
  );

-- Fix community_chat_messages delete
DROP POLICY IF EXISTS "Users and admins can delete messages" ON community_chat_messages;
DROP POLICY IF EXISTS "Users can delete own community chat messages" ON community_chat_messages;

CREATE POLICY "Users and admins can delete messages"
  ON community_chat_messages FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_chat_messages.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'moderator')
    )
  );

-- Fix community_lessons - drop admin policy only
DROP POLICY IF EXISTS "Community admins can manage lessons" ON community_lessons;

-- Fix community_modules - drop admin policy only  
DROP POLICY IF EXISTS "Community admins can manage modules" ON community_modules;

-- Fix community_posts insert - drop simple policy, keep channel restrictions
DROP POLICY IF EXISTS "Members can create posts in their communities" ON community_posts;

-- Fix connections
DROP POLICY IF EXISTS "Users can view received connection requests" ON connections;
DROP POLICY IF EXISTS "Users can view sent connection requests" ON connections;

CREATE POLICY "Users can view connection requests"
  ON connections FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() OR recipient_id = auth.uid()
  );
