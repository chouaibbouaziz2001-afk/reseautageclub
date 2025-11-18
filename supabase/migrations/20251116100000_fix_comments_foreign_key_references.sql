/*
  # Fix Comments System - Foreign Key References

  ## Problem
  The post_comments table references a non-existent "posts" table.
  The actual table is "community_posts".

  ## Changes
  1. Drop existing foreign key constraint on post_comments.post_id
  2. Add correct foreign key referencing community_posts(id)
  3. Drop existing foreign key constraint on post_mentions.post_id
  4. Add correct foreign key referencing community_posts(id)
  5. Ensure all related indexes are correct

  ## Impact
  - Fixes comment creation errors
  - Enables proper cascading deletes
  - Restores commenting functionality
*/

-- Fix post_comments foreign key
DO $$
BEGIN
  -- Drop the incorrect foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'post_comments_post_id_fkey'
    AND table_name = 'post_comments'
  ) THEN
    ALTER TABLE post_comments DROP CONSTRAINT post_comments_post_id_fkey;
  END IF;

  -- Add the correct foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'post_comments_post_id_community_posts_fkey'
    AND table_name = 'post_comments'
  ) THEN
    ALTER TABLE post_comments
      ADD CONSTRAINT post_comments_post_id_community_posts_fkey
      FOREIGN KEY (post_id)
      REFERENCES community_posts(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Fix post_mentions foreign key
DO $$
BEGIN
  -- Drop the incorrect foreign key if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'post_mentions_post_id_fkey'
    AND table_name = 'post_mentions'
  ) THEN
    ALTER TABLE post_mentions DROP CONSTRAINT post_mentions_post_id_fkey;
  END IF;

  -- Add the correct foreign key
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'post_mentions_post_id_community_posts_fkey'
    AND table_name = 'post_mentions'
  ) THEN
    ALTER TABLE post_mentions
      ADD CONSTRAINT post_mentions_post_id_community_posts_fkey
      FOREIGN KEY (post_id)
      REFERENCES community_posts(id)
      ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions(post_id);

-- Verify comment counts trigger references correct table
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

-- Recreate trigger to ensure it's using the updated function
DROP TRIGGER IF EXISTS sync_post_comment_counts_trigger ON post_comments;
CREATE TRIGGER sync_post_comment_counts_trigger
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_comment_counts();
