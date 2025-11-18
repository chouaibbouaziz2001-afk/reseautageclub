/*
  # Add Foreign Key from cofounder_profiles to profiles
  
  1. Changes
    - Add foreign key constraint from cofounder_profiles.user_id to profiles.id
    - This enables Supabase to properly join the tables in queries
  
  2. Notes
    - Uses IF NOT EXISTS pattern to be idempotent
    - Foreign key ensures data integrity between tables
*/

-- Add foreign key if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'cofounder_profiles_user_id_fkey' 
    AND table_name = 'cofounder_profiles'
  ) THEN
    ALTER TABLE cofounder_profiles
    ADD CONSTRAINT cofounder_profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;