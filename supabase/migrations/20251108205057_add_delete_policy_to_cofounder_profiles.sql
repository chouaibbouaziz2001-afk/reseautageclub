/*
  # Add Delete Policy for Co-founder Profiles

  1. Changes
    - Add DELETE policy to `cofounder_profiles` table to allow users to delete their own profile
  
  2. Security
    - Users can only delete their own profile (auth.uid() = user_id)
*/

DO $$ 
BEGIN
  -- Check if the policy already exists before creating it
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cofounder_profiles' 
    AND policyname = 'Users can delete own profile'
  ) THEN
    CREATE POLICY "Users can delete own profile"
      ON cofounder_profiles
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;