-- Database Performance Optimization
-- Recommended indexes for ReseautageClub

-- Posts table indexes
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_shared_post_id ON posts(shared_post_id) WHERE shared_post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_author_created ON posts(author_id, created_at DESC);

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_composite ON post_likes(post_id, user_id);

-- Comments indexes
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_post_created ON comments(post_id, created_at DESC);

-- Community members indexes
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_composite ON community_members(community_id, user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON community_members(community_id, role);

-- Communities indexes
CREATE INDEX IF NOT EXISTS idx_communities_creator_id ON communities(creator_id);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_is_private ON communities(is_private);
CREATE INDEX IF NOT EXISTS idx_communities_member_count ON communities(member_count DESC);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, recipient_id, created_at DESC);

-- Community messages indexes
CREATE INDEX IF NOT EXISTS idx_community_messages_community_id ON community_messages(community_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_sender_id ON community_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_created_at ON community_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_messages_composite ON community_messages(community_id, created_at DESC);

-- Connections indexes
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user_id ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_composite ON connections(user_id, status);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read, created_at DESC);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);
CREATE INDEX IF NOT EXISTS idx_profiles_industry ON profiles(industry);

-- Post mentions indexes
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id ON post_mentions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_mentions_mentioned_user_id ON post_mentions(mentioned_user_id);

-- Call requests indexes
CREATE INDEX IF NOT EXISTS idx_call_requests_caller_id ON call_requests(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_receiver_id ON call_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_call_requests_status ON call_requests(status);
CREATE INDEX IF NOT EXISTS idx_call_requests_created_at ON call_requests(created_at DESC);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_community_id ON events(community_id);
CREATE INDEX IF NOT EXISTS idx_events_creator_id ON events(creator_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_posts_feed_query ON posts(created_at DESC, author_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Full text search indexes (if using PostgreSQL)
-- CREATE INDEX IF NOT EXISTS idx_posts_content_fts ON posts USING gin(to_tsvector('english', content));
-- CREATE INDEX IF NOT EXISTS idx_profiles_search_fts ON profiles USING gin(to_tsvector('english', full_name || ' ' || COALESCE(bio, '')));
-- CREATE INDEX IF NOT EXISTS idx_communities_search_fts ON communities USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Performance monitoring query
-- Use this to identify missing indexes:
/*
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    idx_scan as index_scans,
    seq_scan as sequential_scans,
    CASE WHEN seq_scan > 0 THEN seq_tup_read / seq_scan ELSE 0 END as avg_seq_read
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan DESC;
*/
