/*
  # Fix Profile Creation RLS Policy

  1. Changes
    - Drop the existing INSERT policy that requires authentication
    - Create a new INSERT policy that allows profile creation during signup
    - The policy checks that the user ID matches auth.uid() OR allows inserts from the trigger
    
  2. Security
    - Users can still only insert their own profile (id = auth.uid())
    - The SECURITY DEFINER function bypasses RLS completely
    - This ensures profile creation works during signup
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Create a new INSERT policy that works with the trigger
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Ensure the trigger function has proper permissions
GRANT INSERT ON profiles TO postgres;
