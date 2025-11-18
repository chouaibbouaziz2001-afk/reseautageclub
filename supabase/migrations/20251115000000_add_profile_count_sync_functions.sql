/*
  # Add Profile Count Synchronization Functions

  1. New Columns
    - Add followers_count column to profiles
    - Add following_count column to profiles
    - Add connections_count column to profiles

  2. Functions
    - Creates functions to update follower counts
    - Creates functions to update connection counts
    - Ensures real-time count synchronization

  3. Triggers
    - Auto-update counts when followers added/removed
    - Auto-update counts when connections added/removed

  4. Notes
    - All counts sync in real-time
    - Profile updates trigger Realtime events
    - Recalculates existing counts for all users
*/

-- Add count columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'followers_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN followers_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'following_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN following_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'connections_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN connections_count integer DEFAULT 0;
  END IF;
END $$;

-- Function to update follower counts
CREATE OR REPLACE FUNCTION update_follower_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment followers_count for the followed user
    UPDATE profiles 
    SET followers_count = COALESCE(followers_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.following_id;
    
    -- Increment following_count for the follower
    UPDATE profiles 
    SET following_count = COALESCE(following_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.follower_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement followers_count for the unfollowed user
    UPDATE profiles 
    SET followers_count = GREATEST(COALESCE(followers_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = OLD.following_id;
    
    -- Decrement following_count for the unfollower
    UPDATE profiles 
    SET following_count = GREATEST(COALESCE(following_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = OLD.follower_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update connection counts
CREATE OR REPLACE FUNCTION update_connection_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'accepted' THEN
    -- Increment connections_count for user1
    UPDATE profiles 
    SET connections_count = COALESCE(connections_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.user_id1;
    
    -- Increment connections_count for user2
    UPDATE profiles 
    SET connections_count = COALESCE(connections_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.user_id2;
    
  ELSIF TG_OP = 'UPDATE' AND OLD.status != 'accepted' AND NEW.status = 'accepted' THEN
    -- Connection was just accepted
    UPDATE profiles 
    SET connections_count = COALESCE(connections_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.user_id1;
    
    UPDATE profiles 
    SET connections_count = COALESCE(connections_count, 0) + 1,
        updated_at = now()
    WHERE id = NEW.user_id2;
    
  ELSIF TG_OP = 'DELETE' AND OLD.status = 'accepted' THEN
    -- Decrement connections_count for user1
    UPDATE profiles 
    SET connections_count = GREATEST(COALESCE(connections_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = OLD.user_id1;
    
    -- Decrement connections_count for user2
    UPDATE profiles 
    SET connections_count = GREATEST(COALESCE(connections_count, 1) - 1, 0),
        updated_at = now()
    WHERE id = OLD.user_id2;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_follower_counts ON followers;
DROP TRIGGER IF EXISTS sync_connection_counts ON connections;

-- Create triggers for follower counts
CREATE TRIGGER sync_follower_counts
  AFTER INSERT OR DELETE ON followers
  FOR EACH ROW
  EXECUTE FUNCTION update_follower_counts();

-- Create triggers for connection counts
CREATE TRIGGER sync_connection_counts
  AFTER INSERT OR UPDATE OR DELETE ON connections
  FOR EACH ROW
  EXECUTE FUNCTION update_connection_counts();

-- Function to recalculate all counts (for data integrity)
CREATE OR REPLACE FUNCTION recalculate_profile_counts(user_id uuid)
RETURNS void AS $$
BEGIN
  -- Update followers and following counts
  UPDATE profiles
  SET 
    followers_count = (SELECT COUNT(*) FROM followers WHERE following_id = user_id),
    following_count = (SELECT COUNT(*) FROM followers WHERE follower_id = user_id),
    connections_count = (
      SELECT COUNT(*) FROM connections 
      WHERE (user_id1 = user_id OR user_id2 = user_id) 
      AND status = 'accepted'
    ),
    updated_at = now()
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate all counts for existing users
DO $$
DECLARE
  profile_record RECORD;
BEGIN
  FOR profile_record IN SELECT id FROM profiles
  LOOP
    UPDATE profiles
    SET 
      followers_count = COALESCE((SELECT COUNT(*) FROM followers WHERE following_id = profile_record.id), 0),
      following_count = COALESCE((SELECT COUNT(*) FROM followers WHERE follower_id = profile_record.id), 0),
      connections_count = COALESCE((
        SELECT COUNT(*) FROM connections 
        WHERE (user_id1 = profile_record.id OR user_id2 = profile_record.id) 
        AND status = 'accepted'
      ), 0),
      updated_at = now()
    WHERE id = profile_record.id;
  END LOOP;
END $$;
