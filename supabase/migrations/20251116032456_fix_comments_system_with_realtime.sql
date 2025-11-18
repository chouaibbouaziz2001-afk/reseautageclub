/*
  # Fix Comments System with Real-Time Updates
  
  1. Updates to Comments Table
    - Add parent_comment_id for nested replies
    - Add proper indexes for performance
  
  2. RLS Policies
    - Allow all authenticated users to read comments
    - Allow authenticated users to create comments
    - Allow users to update their own comments
    - Allow users to delete their own comments
  
  3. Triggers
    - Auto-increment/decrement comments_count on posts table
    - Sync counts in real-time
  
  4. Performance
    - Indexes on post_id, author_id, parent_comment_id
    - Optimized for real-time queries
*/

-- Add parent_comment_id if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE comments ADD COLUMN parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;
DROP POLICY IF EXISTS "Comments are viewable by everyone" ON comments;
DROP POLICY IF EXISTS "Users can insert comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their comments" ON comments;

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read comments
CREATE POLICY "Anyone can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Allow users to update their own comments  
CREATE POLICY "Users can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- Function to sync comment counts on posts
CREATE OR REPLACE FUNCTION sync_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment comments_count
    UPDATE community_posts 
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement comments_count
    UPDATE community_posts 
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS sync_comments_count_trigger ON comments;

CREATE TRIGGER sync_comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_comments_count();

-- Ensure comments_count column exists on community_posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_posts' AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN comments_count integer DEFAULT 0;
  END IF;
END $$;

-- Backfill comments_count for existing posts
UPDATE community_posts
SET comments_count = (
  SELECT COUNT(*)
  FROM comments
  WHERE comments.post_id = community_posts.id
)
WHERE comments_count IS NULL OR comments_count = 0;
