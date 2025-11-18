/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes on all unindexed foreign keys
    - Improves JOIN performance and query optimization
    - Reduces table scan overhead

  2. Tables Updated
    - admin_chat_messages: sender_id
    - cofounder_call_requests: match_id
    - cofounder_matches: matched_user_id
    - cofounder_messages: sender_id
    - comment_mentions: mentioned_by_user_id
    - comments: author_id
    - community_announcements: author_id
    - community_chat_messages: user_id
    - community_courses: created_by
    - community_live_calls: started_by
    - event_admins: added_by
    - events: created_by, live_started_by
    - live_streams: started_by
    - post_mentions: mentioned_by_user_id
    - room_admins: granted_by, user_id
    - room_announcements: created_by
*/

-- Admin chat messages
CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_sender_id 
  ON admin_chat_messages(sender_id);

-- Cofounder call requests
CREATE INDEX IF NOT EXISTS idx_cofounder_call_requests_match_id 
  ON cofounder_call_requests(match_id);

-- Cofounder matches
CREATE INDEX IF NOT EXISTS idx_cofounder_matches_matched_user_id 
  ON cofounder_matches(matched_user_id);

-- Cofounder messages
CREATE INDEX IF NOT EXISTS idx_cofounder_messages_sender_id 
  ON cofounder_messages(sender_id);

-- Comment mentions
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_by_user_id 
  ON comment_mentions(mentioned_by_user_id);

-- Comments
CREATE INDEX IF NOT EXISTS idx_comments_author_id 
  ON comments(author_id);

-- Community announcements
CREATE INDEX IF NOT EXISTS idx_community_announcements_author_id 
  ON community_announcements(author_id);

-- Community chat messages
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_user_id 
  ON community_chat_messages(user_id);

-- Community courses
CREATE INDEX IF NOT EXISTS idx_community_courses_created_by 
  ON community_courses(created_by);

-- Community live calls
CREATE INDEX IF NOT EXISTS idx_community_live_calls_started_by 
  ON community_live_calls(started_by);

-- Event admins
CREATE INDEX IF NOT EXISTS idx_event_admins_added_by 
  ON event_admins(added_by);

-- Events
CREATE INDEX IF NOT EXISTS idx_events_created_by 
  ON events(created_by);

CREATE INDEX IF NOT EXISTS idx_events_live_started_by 
  ON events(live_started_by);

-- Live streams
CREATE INDEX IF NOT EXISTS idx_live_streams_started_by 
  ON live_streams(started_by);

-- Post mentions
CREATE INDEX IF NOT EXISTS idx_post_mentions_mentioned_by_user_id 
  ON post_mentions(mentioned_by_user_id);

-- Room admins
CREATE INDEX IF NOT EXISTS idx_room_admins_granted_by 
  ON room_admins(granted_by);

CREATE INDEX IF NOT EXISTS idx_room_admins_user_id 
  ON room_admins(user_id);

-- Room announcements
CREATE INDEX IF NOT EXISTS idx_room_announcements_created_by 
  ON room_announcements(created_by);