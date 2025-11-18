/*
  # Add unique constraint to comment_mentions
  
  1. Changes
    - Add unique constraint on (comment_id, mentioned_user_id)
    - Prevents duplicate mentions of the same user in the same comment
  
  2. Purpose
    - Ensures data integrity
    - Allows ON CONFLICT clause in backfill function
*/

-- Add unique constraint to prevent duplicate mentions
ALTER TABLE comment_mentions 
ADD CONSTRAINT comment_mentions_comment_mentioned_unique 
UNIQUE (comment_id, mentioned_user_id);