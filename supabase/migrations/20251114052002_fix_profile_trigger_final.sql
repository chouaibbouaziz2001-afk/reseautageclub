/*
  # Fix Profile Creation Trigger - Final Version
  
  1. Changes
    - Drop problematic user_room trigger that blocks profile creation
    - Recreate profile trigger with proper error handling
    - Make profile creation robust and failsafe
    
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Proper search_path configuration
    - Error handling that won't block user signup
*/

-- Drop the problematic user room trigger
DROP TRIGGER IF EXISTS on_profile_created_create_room ON profiles;

-- Recreate the user room function with safety checks
CREATE OR REPLACE FUNCTION create_user_room()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only create room if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_rooms'
  ) THEN
    BEGIN
      INSERT INTO user_rooms (user_id, name, description)
      VALUES (
        NEW.id,
        NEW.full_name || '''s Room',
        'Welcome to my event space!'
      )
      ON CONFLICT (user_id) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- Log but don't fail
      RAISE WARNING 'Failed to create user room: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger with new safe function
CREATE TRIGGER on_profile_created_create_room
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_user_room();

-- Ensure handle_new_user function is properly configured
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with user data
  INSERT INTO public.profiles (
    id, 
    full_name, 
    email, 
    profile_completed,
    created_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    false,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Recreate auth trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
