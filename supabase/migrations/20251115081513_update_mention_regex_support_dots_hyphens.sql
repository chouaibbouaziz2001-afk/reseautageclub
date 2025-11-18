/*
  # Update mention regex to support dots and hyphens
  
  1. Changes
    - Update backfill_comment_mentions() to support dots (.) and hyphens (-) in usernames
    - Change regex from '@([a-zA-Z0-9_]+' to '@([a-zA-Z0-9_.\-]+'
  
  2. Purpose
    - Support usernames like "zen.aimen20", "user-name", "first.last"
    - Handle real-world username patterns with special characters
*/

CREATE OR REPLACE FUNCTION backfill_comment_mentions()
RETURNS TABLE (
  comments_processed INTEGER,
  mentions_added INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  comment_record RECORD;
  mention_text TEXT;
  mention_pattern TEXT := '@([a-zA-Z0-9_.\-]+(?:\s+[a-zA-Z0-9_.\-]+)*)';
  matched_user_id UUID;
  total_comments INTEGER := 0;
  total_mentions INTEGER := 0;
BEGIN
  -- Loop through all comments that contain @ mentions
  FOR comment_record IN 
    SELECT 
      pc.id as comment_id,
      pc.author_id,
      pc.content,
      pc.post_id
    FROM post_comments pc
    WHERE pc.content ~ '@[a-zA-Z0-9_.\-]+'
  LOOP
    total_comments := total_comments + 1;
    
    -- Extract all mentions from the comment (loop through regex matches)
    FOR mention_text IN 
      SELECT regexp_matches(comment_record.content, mention_pattern, 'g') AS mention
    LOOP
      -- Clean up the mention text (remove @ and extra spaces)
      mention_text := trim(regexp_replace(mention_text, '[{}@"]', '', 'g'));
      
      -- Find matching user (case-insensitive)
      SELECT id INTO matched_user_id
      FROM profiles
      WHERE LOWER(full_name) = LOWER(mention_text)
      LIMIT 1;
      
      -- Insert the mention if we found a matching user
      IF matched_user_id IS NOT NULL THEN
        INSERT INTO comment_mentions (
          comment_id,
          mentioned_user_id,
          mentioned_by_user_id
        )
        VALUES (
          comment_record.comment_id,
          matched_user_id,
          comment_record.author_id
        )
        ON CONFLICT (comment_id, mentioned_user_id) DO NOTHING;
        
        -- Check if we actually inserted (not a duplicate)
        IF FOUND THEN
          total_mentions := total_mentions + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN QUERY SELECT total_comments, total_mentions;
END;
$$;