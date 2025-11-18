/*
  # Add engagement columns to posts table

  1. Changes
    - Add `likes_count` column to posts table (integer, default 0)
    - Add `comments_count` column to posts table (integer, default 0)
  
  2. Purpose
    - Track engagement metrics for posts
    - Enable proper display of likes and comments counts on profile pages
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'likes_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN likes_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'comments_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN comments_count integer DEFAULT 0;
  END IF;
END $$;