/*
  # Add Call Save Options

  1. Changes
    - Add `save_recording` field to `community_calls` (boolean, default false)
    - Add `save_as` field to `community_calls` (text, 'workshop' or 'live_call' or null)
    - Add `recording_url` field to `community_calls` (text, nullable)
    - Add `thumbnail_url` field to `community_calls` (text, nullable)
    
  2. Purpose
    - Allow hosts to choose whether to save the call recording
    - Allow hosts to choose where to save it (workshops or live calls)
    - Store recording and thumbnail URLs for saved calls
    
  3. Notes
    - If save_recording is false, the call is not saved anywhere
    - If save_recording is true, save_as determines the destination
    - 'workshop' saves to workshops table on call end
    - 'live_call' keeps in community_calls as archived recording
*/

-- Add save_recording field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'save_recording'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN save_recording boolean DEFAULT false;
  END IF;
END $$;

-- Add save_as field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'save_as'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN save_as text;
    ALTER TABLE community_calls ADD CONSTRAINT community_calls_save_as_check 
      CHECK (save_as IS NULL OR save_as IN ('workshop', 'live_call'));
  END IF;
END $$;

-- Add recording_url field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN recording_url text;
  END IF;
END $$;

-- Add thumbnail_url field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- Add description field for saved recordings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'community_calls' AND column_name = 'description'
  ) THEN
    ALTER TABLE community_calls ADD COLUMN description text;
  END IF;
END $$;