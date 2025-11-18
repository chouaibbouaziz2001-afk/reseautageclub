/*
  # Add Post Sharing Feature

  1. Changes
    - Add `shared_post_id` column to posts table to reference original post
    - Add `share_count` column to track how many times a post has been shared
    - Add index on `shared_post_id` for efficient queries
    
  2. Purpose
    - Enable users to reshare posts to their feed (like Facebook share)
    - Track share counts for engagement metrics
    - Maintain reference to original post for display
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'shared_post_id'
  ) THEN
    ALTER TABLE posts ADD COLUMN shared_post_id uuid REFERENCES posts(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'share_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN share_count integer DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_shared_post_id ON posts(shared_post_id);
