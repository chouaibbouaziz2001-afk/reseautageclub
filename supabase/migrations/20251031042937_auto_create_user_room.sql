/*
  # Auto-create User Room

  1. Function
    - Creates a room automatically when a user profile is created
    - Names the room after the user's full name

  2. Trigger
    - Fires after profile insert
    - Creates user_room entry
*/

CREATE OR REPLACE FUNCTION create_user_room()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_rooms (user_id, name, description)
  VALUES (
    NEW.id,
    NEW.full_name || '''s Room',
    'Welcome to my event space!'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_create_room ON profiles;

CREATE TRIGGER on_profile_created_create_room
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_room();