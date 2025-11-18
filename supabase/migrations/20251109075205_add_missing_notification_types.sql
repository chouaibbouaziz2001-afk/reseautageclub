/*
  # Add Missing Notification Types

  1. Updates
    - Drops and recreates the notifications_type_check constraint to include all notification types
    - Adds support for:
      - post_share
      - post_mention
      - comment_mention
      - community_mention
      - event_reminder
      - event_rsvp
      - cofounder_like
      - cofounder_message
  
  2. Notes
    - This ensures all notification types defined in the notification helpers are valid
    - Existing notifications are not affected
*/

-- Drop the old constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with all notification types
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'follow',
    'connection_request',
    'connection_accepted',
    'message',
    'post_like',
    'post_comment',
    'post_share',
    'post_mention',
    'comment_mention',
    'community_invite',
    'community_post',
    'community_join',
    'community_mention',
    'event_invite',
    'event_reminder',
    'event_rsvp',
    'cofounder_match',
    'cofounder_like',
    'cofounder_message',
    'profile_view'
  ));
