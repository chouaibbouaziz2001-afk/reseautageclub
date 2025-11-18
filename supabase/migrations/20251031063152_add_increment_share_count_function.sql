/*
  # Add Share Count Increment Function

  1. New Function
    - `increment_share_count` - Safely increments the share_count for a post
    
  2. Purpose
    - Atomically increment share count when a post is shared
    - Prevent race conditions in concurrent share operations
*/

CREATE OR REPLACE FUNCTION increment_share_count(post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE posts
  SET share_count = COALESCE(share_count, 0) + 1
  WHERE id = post_id;
END;
$$;
