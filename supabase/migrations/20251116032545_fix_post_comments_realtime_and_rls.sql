/*
  # Fix Post Comments with Real-Time and Proper RLS
  
  1. Enable Realtime on post_comments
  2. Update RLS policies for proper access control
  3. Add triggers for comment count synchronization
  4. Add delete functionality with proper permissions
*/

-- Enable realtime on post_comments
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view post comments" ON post_comments;
DROP POLICY IF EXISTS "Users can create comments on posts" ON post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON post_comments;
DROP POLICY IF EXISTS "Comments are public" ON post_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON post_comments;
DROP POLICY IF EXISTS "Users can update own comments" ON post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON post_comments;

-- Enable RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view comments
CREATE POLICY "Anyone can view post comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Allow users to update their own comments
CREATE POLICY "Users can update own comments"
  ON post_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- Allow users to delete their own comments
CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- Function to sync comment counts on community_posts
CREATE OR REPLACE FUNCTION sync_post_comment_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE community_posts 
    SET comments_count = COALESCE(comments_count, 0) + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE community_posts 
    SET comments_count = GREATEST(COALESCE(comments_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS sync_post_comment_counts_trigger ON post_comments;

CREATE TRIGGER sync_post_comment_counts_trigger
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_comment_counts();

-- Backfill comments_count for existing posts
UPDATE community_posts
SET comments_count = (
  SELECT COUNT(*)
  FROM post_comments
  WHERE post_comments.post_id = community_posts.id
);
