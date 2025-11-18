/*
  # Add Media Support to Admin Chat

  1. Changes to admin_chat_messages table
    - Add `media_url` column for file URLs
    - Add `media_type` column (image, video, audio, file)
    - Message becomes optional when media is present

  2. Storage
    - Ensure media bucket policies allow admin uploads
*/

-- Add media columns to admin_chat_messages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_chat_messages' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE admin_chat_messages ADD COLUMN media_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_chat_messages' AND column_name = 'media_type'
  ) THEN
    ALTER TABLE admin_chat_messages ADD COLUMN media_type text;
  END IF;
END $$;

-- Make message optional (allow media-only messages)
ALTER TABLE admin_chat_messages ALTER COLUMN message DROP NOT NULL;

-- Update storage policies for media bucket (if exists)
DO $$
BEGIN
  -- Allow admins to upload to admin-chat folder
  IF EXISTS (
    SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
  ) THEN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Admins can upload admin chat media" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can view admin chat media" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can delete admin chat media" ON storage.objects;

    -- Create new policies
    CREATE POLICY "Admins can upload admin chat media"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'media' 
        AND (storage.foldername(name))[1] = 'admin-chat'
        AND EXISTS (
          SELECT 1 FROM event_admins
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can view admin chat media"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'media' 
        AND (storage.foldername(name))[1] = 'admin-chat'
        AND EXISTS (
          SELECT 1 FROM event_admins
          WHERE user_id = auth.uid()
        )
      );

    CREATE POLICY "Admins can delete admin chat media"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'media' 
        AND (storage.foldername(name))[1] = 'admin-chat'
        AND EXISTS (
          SELECT 1 FROM event_admins
          WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
