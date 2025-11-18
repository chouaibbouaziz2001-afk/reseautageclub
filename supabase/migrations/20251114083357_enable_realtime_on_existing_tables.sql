/*
  # Enable Realtime on All Interactive Tables

  1. Tables to Enable Realtime
    - posts - For feed updates
    - post_comments - For comment updates
    - comment_likes - For like counts on comments
    - comments - For general comments
    - messages - For chat updates
    - notifications - For notification bell
    - connections - For connection requests
    - follows - For follower updates
    - community_posts - For community feed
    - community_members - For member counts
    - community_chat_messages - For community chat
    - event_attendees - For RSVP counts
    - profile_views - For view counts
    - profiles - For online status updates

  2. Important Notes
    - Realtime enables instant updates across all users
    - INSERT, UPDATE, DELETE events are broadcast
    - Filters applied in client-side subscriptions
*/

-- Enable Realtime on posts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE posts;
    END IF;
  END IF;
END $$;

-- Enable Realtime on post_comments table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_comments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'post_comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
    END IF;
  END IF;
END $$;

-- Enable Realtime on comment_likes table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_likes') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'comment_likes'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE comment_likes;
    END IF;
  END IF;
END $$;

-- Enable Realtime on comments table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'comments'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE comments;
    END IF;
  END IF;
END $$;

-- Enable Realtime on messages table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
  END IF;
END $$;

-- Enable Realtime on notifications table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
  END IF;
END $$;

-- Enable Realtime on connections table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'connections') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'connections'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE connections;
    END IF;
  END IF;
END $$;

-- Enable Realtime on follows table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follows') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'follows'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE follows;
    END IF;
  END IF;
END $$;

-- Enable Realtime on community_posts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_posts') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'community_posts'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
    END IF;
  END IF;
END $$;

-- Enable Realtime on community_members table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_members') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'community_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
    END IF;
  END IF;
END $$;

-- Enable Realtime on community_chat_messages table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'community_chat_messages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'community_chat_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE community_chat_messages;
    END IF;
  END IF;
END $$;

-- Enable Realtime on event_attendees table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_attendees') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'event_attendees'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE event_attendees;
    END IF;
  END IF;
END $$;

-- Enable Realtime on profile_views table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profile_views') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'profile_views'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE profile_views;
    END IF;
  END IF;
END $$;

-- Enable Realtime on profiles table (for online status)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
    END IF;
  END IF;
END $$;

-- Enable Realtime on cofounder_profiles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cofounder_profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'cofounder_profiles'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE cofounder_profiles;
    END IF;
  END IF;
END $$;

-- Enable Realtime on workshops table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workshops') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'workshops'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE workshops;
    END IF;
  END IF;
END $$;

-- Enable Realtime on cofounder_messages table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cofounder_messages') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'cofounder_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE cofounder_messages;
    END IF;
  END IF;
END $$;
