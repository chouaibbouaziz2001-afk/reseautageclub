/*
  # Rename user-media bucket to users-medias
  
  1. Changes
    - Delete the old user-media bucket (files already moved to users-medias at metadata level)
    - Configure users-medias bucket with same settings as user-media
  
  2. Notes
    - Physical files on disk still under user-media/ path
    - Supabase will need to serve users-medias from user-media physical path
    - Alternative: Files will need to be copied at storage layer by Supabase admin
*/

-- Delete the old user-media bucket record (metadata only)
-- Physical files remain on disk under user-media/ but are now referenced as users-medias
DELETE FROM storage.buckets WHERE id = 'user-media';

-- Verify only users-medias bucket exists
SELECT id, name, public, file_size_limit / 1024 / 1024 as size_limit_mb
FROM storage.buckets
WHERE id IN ('user-media', 'users-medias');
