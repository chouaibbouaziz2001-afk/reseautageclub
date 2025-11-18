-- Migration script to convert storage URLs to reference format
-- This converts all storage URLs to the format: user-media:path or websiteconfig:path

-- Update profiles.avatar_url
UPDATE profiles
SET avatar_url = 'user-media:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/(user-media|users-medias|media)/';

UPDATE profiles
SET avatar_url = 'websiteconfig:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/websiteconfig/(.+?)(\?.*)?$', '\2')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/websiteconfig/';

-- Update posts.image_url
UPDATE posts
SET image_url = 'user-media:' || REGEXP_REPLACE(image_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE image_url LIKE '%/storage/v1/object/%'
  AND image_url ~ '/(user-media|users-medias|media)/';

UPDATE posts
SET image_url = 'websiteconfig:' || REGEXP_REPLACE(image_url, '^.*/storage/v1/object/(public|sign)/websiteconfig/(.+?)(\?.*)?$', '\2')
WHERE image_url LIKE '%/storage/v1/object/%'
  AND image_url ~ '/websiteconfig/';

-- Update posts.video_url
UPDATE posts
SET video_url = 'user-media:' || REGEXP_REPLACE(video_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE video_url LIKE '%/storage/v1/object/%'
  AND video_url ~ '/(user-media|users-medias|media)/';

-- Update communities.avatar_url
UPDATE communities
SET avatar_url = 'user-media:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/(user-media|users-medias|media)/';

UPDATE communities
SET avatar_url = 'websiteconfig:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/websiteconfig/(.+?)(\?.*)?$', '\2')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/websiteconfig/';

-- Update community_posts (image, video, audio)
UPDATE community_posts
SET image_url = 'user-media:' || REGEXP_REPLACE(image_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE image_url LIKE '%/storage/v1/object/%'
  AND image_url ~ '/(user-media|users-medias|media)/';

UPDATE community_posts
SET video_url = 'user-media:' || REGEXP_REPLACE(video_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE video_url LIKE '%/storage/v1/object/%'
  AND video_url ~ '/(user-media|users-medias|media)/';

UPDATE community_posts
SET audio_url = 'user-media:' || REGEXP_REPLACE(audio_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE audio_url LIKE '%/storage/v1/object/%'
  AND audio_url ~ '/(user-media|users-medias|media)/';

-- Update community_chat_messages.media_url
UPDATE community_chat_messages
SET media_url = 'user-media:' || REGEXP_REPLACE(media_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE media_url LIKE '%/storage/v1/object/%'
  AND media_url ~ '/(user-media|users-medias|media)/';

-- Update cofounder_messages.media_url
UPDATE cofounder_messages
SET media_url = 'user-media:' || REGEXP_REPLACE(media_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE media_url LIKE '%/storage/v1/object/%'
  AND media_url ~ '/(user-media|users-medias|media)/';

-- Update admin_chat_messages.media_url
UPDATE admin_chat_messages
SET media_url = 'user-media:' || REGEXP_REPLACE(media_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE media_url LIKE '%/storage/v1/object/%'
  AND media_url ~ '/(user-media|users-medias|media)/';

-- Update events.cover_image_url
UPDATE events
SET cover_image_url = 'user-media:' || REGEXP_REPLACE(cover_image_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE cover_image_url LIKE '%/storage/v1/object/%'
  AND cover_image_url ~ '/(user-media|users-medias|media)/';

UPDATE events
SET cover_image_url = 'websiteconfig:' || REGEXP_REPLACE(cover_image_url, '^.*/storage/v1/object/(public|sign)/websiteconfig/(.+?)(\?.*)?$', '\2')
WHERE cover_image_url LIKE '%/storage/v1/object/%'
  AND cover_image_url ~ '/websiteconfig/';

-- Update user_rooms.avatar_url
UPDATE user_rooms
SET avatar_url = 'user-media:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/([^/]+)/(.+?)(\?.*)?$', '\3')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/(user-media|users-medias|media)/';

UPDATE user_rooms
SET avatar_url = 'websiteconfig:' || REGEXP_REPLACE(avatar_url, '^.*/storage/v1/object/(public|sign)/websiteconfig/(.+?)(\?.*)?$', '\2')
WHERE avatar_url LIKE '%/storage/v1/object/%'
  AND avatar_url ~ '/websiteconfig/';

-- Display summary
SELECT 'Migration Complete!' as status;
SELECT 'Profiles with user-media refs' as metric, COUNT(*) as count FROM profiles WHERE avatar_url LIKE 'user-media:%'
UNION ALL
SELECT 'Posts with user-media refs', COUNT(*) FROM posts WHERE image_url LIKE 'user-media:%' OR video_url LIKE 'user-media:%'
UNION ALL
SELECT 'Communities with user-media refs', COUNT(*) FROM communities WHERE avatar_url LIKE 'user-media:%';
