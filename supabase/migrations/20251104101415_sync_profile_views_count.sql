/*
  # Sync Profile Views Count
  
  1. Function to sync profile views count
    - Creates a function to recalculate and update profile_views_count for all profiles
    - Can be called manually or via a scheduled job
  
  2. Ensure trigger is working correctly
    - Recreates the trigger to ensure it's functioning properly
*/

-- Function to sync all profile view counts
CREATE OR REPLACE FUNCTION sync_all_profile_view_counts()
RETURNS void AS $$
BEGIN
  UPDATE profiles p
  SET profile_views_count = (
    SELECT COUNT(*)
    FROM profile_views pv
    WHERE pv.viewed_profile_id = p.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the increment function to ensure it works
CREATE OR REPLACE FUNCTION increment_profile_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET profile_views_count = COALESCE(profile_views_count, 0) + 1
  WHERE id = NEW.viewed_profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_increment_profile_view_count ON profile_views;
CREATE TRIGGER trigger_increment_profile_view_count
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_profile_view_count();

-- Run initial sync to fix any existing discrepancies
SELECT sync_all_profile_view_counts();
