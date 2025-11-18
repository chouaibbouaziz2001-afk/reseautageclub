/*
  # Auto-create profile on user signup

  1. Changes
    - Creates a trigger function that automatically creates a profile when a new user signs up
    - This ensures every authenticated user has a corresponding profile entry
    - Uses the user's email as the initial full_name (can be updated later)
  
  2. Security
    - Function runs with SECURITY DEFINER to bypass RLS during profile creation
    - Only triggers on INSERT to auth.users table
    - Ensures profile creation happens automatically without requiring manual intervention
*/

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, profile_completed)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
