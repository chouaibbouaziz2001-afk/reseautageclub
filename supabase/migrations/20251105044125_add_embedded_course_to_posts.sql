/*
  # Add Embedded Course Support to Posts

  1. Changes
    - Add `embedded_course_id` column to community_posts for course card embeds
    - This allows admins to embed course cards in start-here posts
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'community_posts' AND column_name = 'embedded_course_id'
  ) THEN
    ALTER TABLE community_posts ADD COLUMN embedded_course_id uuid REFERENCES community_courses(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_posts_embedded_course ON community_posts(embedded_course_id);