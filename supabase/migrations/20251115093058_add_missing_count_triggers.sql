/*
  # Add Missing Count Triggers
  
  1. Triggers Created
    - Comments count trigger: Updates posts.comments_count when comments added/removed
    - Follower count trigger: Updates profiles follower/following counts when follows added/removed
  
  2. Purpose
    - Keeps count columns automatically synchronized with actual data
    - Prevents count drift and ensures data consistency
    - Improves performance by avoiding count queries
*/

-- Function to update comments count on posts
CREATE OR REPLACE FUNCTION update_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Create trigger on comments table
DROP TRIGGER IF EXISTS update_comments_count_trigger ON comments;
CREATE TRIGGER update_comments_count_trigger
  AFTER INSERT OR DELETE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_count();

-- Function to update follower and following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the user being followed
    UPDATE profiles
    SET follower_count = COALESCE(follower_count, 0) + 1
    WHERE id = NEW.following_id;
    
    -- Increment following count for the follower
    UPDATE profiles
    SET following_count = COALESCE(following_count, 0) + 1
    WHERE id = NEW.follower_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count for the user being unfollowed
    UPDATE profiles
    SET follower_count = GREATEST(0, COALESCE(follower_count, 0) - 1)
    WHERE id = OLD.following_id;
    
    -- Decrement following count for the unfollower
    UPDATE profiles
    SET following_count = GREATEST(0, COALESCE(following_count, 0) - 1)
    WHERE id = OLD.follower_id;
    
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Create trigger on follows table
DROP TRIGGER IF EXISTS update_follow_counts_trigger ON follows;
CREATE TRIGGER update_follow_counts_trigger
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_counts();

-- Check if profiles table has follower_count and following_count columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'follower_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN follower_count INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'following_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN following_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Backfill follower and following counts
UPDATE profiles p
SET 
  follower_count = (
    SELECT COUNT(*) FROM follows WHERE following_id = p.id
  ),
  following_count = (
    SELECT COUNT(*) FROM follows WHERE follower_id = p.id
  );
