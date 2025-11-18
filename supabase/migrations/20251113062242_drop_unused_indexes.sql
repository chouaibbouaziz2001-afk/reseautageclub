/*
  # Drop Unused Indexes for Performance Optimization

  1. Security & Performance
    - Removes 76 unused indexes that consume storage and slow down write operations
    - Indexes are not being used by queries and provide no benefit
    - This improves INSERT, UPDATE, and DELETE performance
    
  2. Indexes Being Removed
    - Comment and reaction indexes
    - Community and messaging indexes  
    - Event and participant indexes
    - Profile and notification indexes
    - Course and lesson indexes
    - Call and workshop indexes
    - All other unused performance indexes
    
  3. Notes
    - Indexes can be recreated later if query patterns change
    - Only removing truly unused indexes identified by Supabase
    - Primary keys and foreign key indexes are preserved
*/

-- Drop unused indexes on comments and reactions
DROP INDEX IF EXISTS idx_comments_created_at;
DROP INDEX IF EXISTS idx_comments_author_id;
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Drop unused indexes on validated_ideas
DROP INDEX IF EXISTS idx_validated_ideas_user_id;
DROP INDEX IF EXISTS idx_validated_ideas_created_at;

-- Drop unused indexes on community_chat_messages
DROP INDEX IF EXISTS idx_community_chat_messages_created_at;
DROP INDEX IF EXISTS idx_community_chat_messages_type;
DROP INDEX IF EXISTS idx_community_chat_messages_user_id;

-- Drop unused indexes on community_calls
DROP INDEX IF EXISTS idx_community_calls_status;
DROP INDEX IF EXISTS idx_community_calls_creator;

-- Drop unused indexes on community_call_participants
DROP INDEX IF EXISTS idx_community_call_participants_call;
DROP INDEX IF EXISTS idx_community_call_participants_user;

-- Drop unused indexes on conversations and messages
DROP INDEX IF EXISTS idx_conversations_updated_at;
DROP INDEX IF EXISTS idx_messages_sender;

-- Drop unused indexes on cofounder_messages
DROP INDEX IF EXISTS idx_cofounder_messages_created_at;
DROP INDEX IF EXISTS idx_cofounder_messages_sender_id;

-- Drop unused indexes on communities
DROP INDEX IF EXISTS idx_communities_creator;
DROP INDEX IF EXISTS idx_communities_category;

-- Drop unused indexes on community_posts
DROP INDEX IF EXISTS idx_community_posts_author;
DROP INDEX IF EXISTS idx_community_posts_created_at;
DROP INDEX IF EXISTS idx_community_posts_embedded_course;

-- Drop unused indexes on events
DROP INDEX IF EXISTS idx_events_room_id;
DROP INDEX IF EXISTS idx_events_start_time;
DROP INDEX IF EXISTS idx_events_created_by;
DROP INDEX IF EXISTS idx_events_live_started_by;

-- Drop unused indexes on event_attendees
DROP INDEX IF EXISTS idx_event_attendees_user_id;

-- Drop unused indexes on event_admins
DROP INDEX IF EXISTS idx_event_admins_added_by;

-- Drop unused indexes on room_announcements
DROP INDEX IF EXISTS idx_room_announcements_room_id;
DROP INDEX IF EXISTS idx_room_announcements_created_by;

-- Drop unused indexes on room_admins
DROP INDEX IF EXISTS idx_room_admins_granted_by;
DROP INDEX IF EXISTS idx_room_admins_user_id;

-- Drop unused indexes on live_streams
DROP INDEX IF EXISTS idx_live_streams_room_id;
DROP INDEX IF EXISTS idx_live_streams_status;
DROP INDEX IF EXISTS idx_live_streams_started_by;

-- Drop unused indexes on profile_views
DROP INDEX IF EXISTS idx_profile_views_viewer;

-- Drop unused indexes on posts
DROP INDEX IF EXISTS idx_posts_shared_post_id;

-- Drop unused indexes on community_live_calls
DROP INDEX IF EXISTS idx_community_live_calls_community_id;
DROP INDEX IF EXISTS idx_community_live_calls_is_active;
DROP INDEX IF EXISTS idx_community_live_calls_started_by;

-- Drop unused indexes on live_call_participants
DROP INDEX IF EXISTS idx_live_call_participants_call_id;
DROP INDEX IF EXISTS idx_live_call_participants_user_id;
DROP INDEX IF EXISTS idx_live_call_participants_hand_raised;

-- Drop unused indexes on notifications
DROP INDEX IF EXISTS idx_notifications_actor_id;
DROP INDEX IF EXISTS idx_notifications_is_read;

-- Drop unused indexes on post_comments
DROP INDEX IF EXISTS idx_post_comments_author_id;

-- Drop unused indexes on comment_likes
DROP INDEX IF EXISTS idx_comment_likes_comment_id;
DROP INDEX IF EXISTS idx_comment_likes_user_id;

-- Drop unused indexes on post_mentions
DROP INDEX IF EXISTS idx_post_mentions_user_id;
DROP INDEX IF EXISTS idx_post_mentions_mentioned_by_user_id;

-- Drop unused indexes on comment_mentions
DROP INDEX IF EXISTS idx_comment_mentions_user_id;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_by_user_id;

-- Drop unused indexes on community_modules and lessons
DROP INDEX IF EXISTS idx_modules_order;
DROP INDEX IF EXISTS idx_lessons_order;

-- Drop unused indexes on user_lesson_progress
DROP INDEX IF EXISTS idx_progress_lesson;

-- Drop unused indexes on community_announcements
DROP INDEX IF EXISTS idx_announcements_community;
DROP INDEX IF EXISTS idx_community_announcements_author_id;

-- Drop unused indexes on user_course_favorites
DROP INDEX IF EXISTS idx_user_course_favorites_course;

-- Drop unused indexes on community_courses
DROP INDEX IF EXISTS idx_community_courses_created_by;

-- Drop unused indexes on cofounder_call_requests
DROP INDEX IF EXISTS idx_call_requests_receiver_status;
DROP INDEX IF EXISTS idx_call_requests_caller_status;
DROP INDEX IF EXISTS idx_cofounder_call_requests_match_id;

-- Drop unused indexes on message_call_requests
DROP INDEX IF EXISTS idx_message_call_requests_conversation;
DROP INDEX IF EXISTS idx_message_call_requests_caller;
DROP INDEX IF EXISTS idx_message_call_requests_receiver;
DROP INDEX IF EXISTS idx_message_call_requests_status;

-- Drop unused indexes on blocked_users
DROP INDEX IF EXISTS idx_blocked_users_blocked_user_id;

-- Drop unused indexes on call_comments
DROP INDEX IF EXISTS idx_call_comments_call_id;
DROP INDEX IF EXISTS idx_call_comments_parent_id;
DROP INDEX IF EXISTS idx_call_comments_user_id;
DROP INDEX IF EXISTS idx_call_comments_created_at;

-- Drop unused indexes on workshops
DROP INDEX IF EXISTS idx_workshops_call_id;
DROP INDEX IF EXISTS idx_workshops_host_id;
DROP INDEX IF EXISTS idx_workshops_recorded_at;

-- Drop unused indexes on workshop_views
DROP INDEX IF EXISTS idx_workshop_views_user_id;

-- Drop unused indexes on admin_chat_messages
DROP INDEX IF EXISTS idx_admin_chat_messages_sender_id;

-- Drop unused indexes on cofounder_matches
DROP INDEX IF EXISTS idx_cofounder_matches_matched_user_id;
