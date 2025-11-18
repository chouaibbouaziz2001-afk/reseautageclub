/*
  # Add Service Role Storage Access for Dashboard Visibility

  1. Problem
    - Files are successfully uploaded to user-media bucket (27 files, 32 MB)
    - Posts correctly reference storage URLs (user-media:path format)
    - Supabase dashboard shows bucket as empty due to missing service_role policies
  
  2. Solution
    - Add service_role SELECT policy for user-media bucket
    - This allows viewing all files in Supabase Storage dashboard
    - Does not affect end-user security (only service_role can use this)
  
  3. Security
    - Service role policies only apply to admin/backend operations
    - Existing user policies remain unchanged and secure
    - Public can still view files via signed URLs in the app
*/

-- Add service_role SELECT policy for user-media bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'Service role can view all user-media'
  ) THEN
    CREATE POLICY "Service role can view all user-media"
      ON storage.objects FOR SELECT
      TO service_role
      USING (bucket_id = 'user-media');
  END IF;
END $$;

-- Verify the policy was created
SELECT policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'objects'
AND schemaname = 'storage'
AND policyname = 'Service role can view all user-media';
