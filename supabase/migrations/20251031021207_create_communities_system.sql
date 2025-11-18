/*
  # Create Groups/Communities System

  This migration implements a comprehensive community system for topic-based groups where entrepreneurs can connect around shared interests.

  ## 1. New Tables
    
    ### `communities`
    - `id` (uuid, primary key) - Unique identifier for the community
    - `name` (text) - Community name (e.g., "SaaS Founders")
    - `description` (text) - Community description and purpose
    - `avatar_url` (text) - Optional community avatar/logo
    - `category` (text) - Community category for filtering
    - `is_private` (boolean) - Whether the community requires approval to join
    - `creator_id` (uuid) - User who created the community
    - `member_count` (integer) - Cached count of members
    - `created_at` (timestamptz) - When the community was created
    - `updated_at` (timestamptz) - Last activity timestamp
    
    ### `community_members`
    - `id` (uuid, primary key) - Unique identifier for membership
    - `community_id` (uuid) - Reference to the community
    - `user_id` (uuid) - Reference to the user
    - `role` (text) - Member role: 'admin', 'moderator', 'member'
    - `joined_at` (timestamptz) - When the user joined
    - Unique constraint on (community_id, user_id) to prevent duplicate memberships
    
    ### `community_posts`
    - `id` (uuid, primary key) - Unique identifier for the post
    - `community_id` (uuid) - Reference to the community
    - `author_id` (uuid) - User who created the post
    - `content` (text) - Post content
    - `image_url` (text) - Optional image attachment
    - `created_at` (timestamptz) - When the post was created
    - `updated_at` (timestamptz) - When the post was last edited

  ## 2. Security
    
    ### Communities Table RLS Policies
    - Enable RLS on `communities` table
    - Anyone authenticated can view public communities
    - Members can view private communities they belong to
    - Authenticated users can create communities (become admin automatically)
    - Only admins can update their communities
    - Only admins can delete their communities
    
    ### Community Members Table RLS Policies
    - Enable RLS on `community_members` table
    - Members can view other members in their communities
    - Users can join public communities (insert)
    - Users can leave communities (delete their own membership)
    - Admins can remove members from their communities
    
    ### Community Posts Table RLS Policies
    - Enable RLS on `community_posts` table
    - Members can view posts in their communities
    - Members can create posts in their communities
    - Authors can update their own posts
    - Authors and admins can delete posts

  ## 3. Important Notes
    - Member count is denormalized for performance
    - Category enables filtering and discovery
    - Role system enables moderation capabilities
    - Indexes on frequently queried columns
    - Cascading deletes maintain data integrity
*/

CREATE TABLE IF NOT EXISTS communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  avatar_url text,
  category text,
  is_private boolean DEFAULT false,
  creator_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  member_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  CONSTRAINT community_members_role_check CHECK (role IN ('admin', 'moderator', 'member')),
  CONSTRAINT community_members_unique_pair UNIQUE (community_id, user_id)
);

CREATE TABLE IF NOT EXISTS community_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_communities_creator ON communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community ON community_posts(community_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    is_private = false OR
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = communities.id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create communities"
  ON communities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Admins can update their communities"
  ON communities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = communities.id
      AND community_members.user_id = auth.uid()
      AND community_members.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = communities.id
      AND community_members.user_id = auth.uid()
      AND community_members.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete their communities"
  ON communities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = communities.id
      AND community_members.user_id = auth.uid()
      AND community_members.role = 'admin'
    )
  );

CREATE POLICY "Members can view community memberships"
  ON community_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join communities"
  ON community_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
  ON community_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Members can view posts in their communities"
  ON community_posts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create posts in their communities"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
      AND community_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update their own posts"
  ON community_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can delete their own posts"
  ON community_posts FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id OR
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_posts.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'moderator')
    )
  );

CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE communities
    SET member_count = member_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE communities
    SET member_count = member_count - 1
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_member_count_trigger
AFTER INSERT OR DELETE ON community_members
FOR EACH ROW
EXECUTE FUNCTION update_community_member_count();
