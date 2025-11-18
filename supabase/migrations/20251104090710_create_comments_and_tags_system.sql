/*
  # Create Comments, Tags, and Mentions System

  ## Overview
  This migration creates a comprehensive comment system with likes, nested replies,
  and a tagging/mention system for both posts and comments.

  ## New Tables
  
  ### 1. `post_comments`
    - `id` (uuid, primary key) - Unique comment identifier
    - `post_id` (uuid, foreign key) - References the post
    - `author_id` (uuid, foreign key) - Comment author
    - `content` (text) - Comment text content
    - `parent_comment_id` (uuid, nullable) - For nested replies
    - `likes_count` (integer) - Count of likes
    - `replies_count` (integer) - Count of replies
    - `created_at` (timestamptz) - Creation timestamp
    - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `comment_likes`
    - `id` (uuid, primary key)
    - `comment_id` (uuid, foreign key) - References comment
    - `user_id` (uuid, foreign key) - User who liked
    - `created_at` (timestamptz)
    - Unique constraint on (comment_id, user_id)

  ### 3. `post_mentions`
    - `id` (uuid, primary key)
    - `post_id` (uuid, foreign key) - References post
    - `mentioned_user_id` (uuid, foreign key) - Tagged user
    - `mentioned_by_user_id` (uuid, foreign key) - User who tagged
    - `created_at` (timestamptz)

  ### 4. `comment_mentions`
    - `id` (uuid, primary key)
    - `comment_id` (uuid, foreign key) - References comment
    - `mentioned_user_id` (uuid, foreign key) - Tagged user
    - `mentioned_by_user_id` (uuid, foreign key) - User who tagged
    - `created_at` (timestamptz)

  ## Security
  - Enable RLS on all tables
  - Authenticated users can read all comments
  - Users can create comments on any post
  - Users can only like once per comment
  - Users can delete their own comments
  - Users can update their own comments within 5 minutes of creation

  ## Functions
  - `increment_comment_likes_count` - Safely increment comment like count
  - `decrement_comment_likes_count` - Safely decrement comment like count
  - `increment_replies_count` - Update parent comment reply count
  - `decrement_replies_count` - Update parent comment reply count
*/

-- Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  parent_comment_id uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  likes_count integer DEFAULT 0,
  replies_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create comment_likes table
CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- Create post_mentions table
CREATE TABLE IF NOT EXISTS post_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create comment_mentions table
CREATE TABLE IF NOT EXISTS comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentioned_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id ON post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_user_id ON post_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON comment_mentions(mentioned_user_id);

-- Enable RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for post_comments

CREATE POLICY "Anyone can view comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own comments within 5 minutes"
  ON post_comments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = author_id AND
    created_at > now() - interval '5 minutes'
  )
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- RLS Policies for comment_likes

CREATE POLICY "Anyone can view comment likes"
  ON comment_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can like comments"
  ON comment_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own likes"
  ON comment_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for post_mentions

CREATE POLICY "Anyone can view post mentions"
  ON post_mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create post mentions"
  ON post_mentions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = mentioned_by_user_id);

-- RLS Policies for comment_mentions

CREATE POLICY "Anyone can view comment mentions"
  ON comment_mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create comment mentions"
  ON comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = mentioned_by_user_id);

-- Function to increment comment likes count
CREATE OR REPLACE FUNCTION increment_comment_likes_count(comment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE post_comments
  SET likes_count = likes_count + 1
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement comment likes count
CREATE OR REPLACE FUNCTION decrement_comment_likes_count(comment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE post_comments
  SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment replies count
CREATE OR REPLACE FUNCTION increment_replies_count(parent_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE post_comments
  SET replies_count = replies_count + 1
  WHERE id = parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrement replies count
CREATE OR REPLACE FUNCTION decrement_replies_count(parent_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE post_comments
  SET replies_count = GREATEST(replies_count - 1, 0)
  WHERE id = parent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update replies_count when a reply is added
CREATE OR REPLACE FUNCTION update_replies_count_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_comment_id IS NOT NULL THEN
    PERFORM increment_replies_count(NEW.parent_comment_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_replies_count
  AFTER INSERT ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_replies_count_on_insert();

-- Trigger to update replies_count when a reply is deleted
CREATE OR REPLACE FUNCTION update_replies_count_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.parent_comment_id IS NOT NULL THEN
    PERFORM decrement_replies_count(OLD.parent_comment_id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_replies_count
  AFTER DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_replies_count_on_delete();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_comment_timestamp
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_updated_at();
