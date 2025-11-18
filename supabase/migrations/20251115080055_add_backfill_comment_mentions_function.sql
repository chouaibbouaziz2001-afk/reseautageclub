/*
  # Add function to backfill comment mentions
  
  1. New Functions
    - `backfill_comment_mentions()` - Analyzes existing comment content and populates comment_mentions table
  
  2. Purpose
    - Ensures all existing comments have their mentions properly tracked
    - Uses case-insensitive matching to find mentioned users
    - Can be run manually or on a schedule
  
  3. Notes
    - Safe to run multiple times (uses ON CONFLICT DO NOTHING)
    - Only processes comments that mention users with @ symbol
    - Matches user full_name case-insensitively
*/

-- Function to extract and save mentions from existing comments
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
  mention_pattern TEXT := '@([a-zA-Z]+(?:\s+[a-zA-Z]+)*)';
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
    WHERE pc.content ~ '@[a-zA-Z]+'
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION backfill_comment_mentions() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION backfill_comment_mentions() IS 
'Backfills comment_mentions table by parsing existing comment content for @mentions. Safe to run multiple times.';