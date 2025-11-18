/*
  # Create Comprehensive Notifications System

  1. New Tables
    
    ### `notifications`
    - `id` (uuid, primary key) - Unique identifier for notification
    - `user_id` (uuid) - User who receives the notification
    - `actor_id` (uuid) - User who triggered the notification
    - `type` (text) - Type of notification: 'follow', 'connection_request', 'connection_accepted', 'message', 'post_like', 'post_comment', 'community_invite', 'community_post', 'event_invite', 'cofounder_match'
    - `entity_type` (text) - Type of related entity: 'user', 'post', 'community', 'event', 'message'
    - `entity_id` (uuid) - ID of the related entity
    - `content` (text) - Notification message content
    - `is_read` (boolean) - Whether notification has been read
    - `created_at` (timestamptz) - When notification was created
    
  2. Security
    
    ### Notifications RLS Policies
    - Enable RLS on `notifications` table
    - Users can view their own notifications
    - Users can mark their own notifications as read
    - System can create notifications for any user
    
  3. Important Notes
    - Notifications are created automatically when actions occur
    - Real-time updates using Supabase subscriptions
    - All user interactions tracked (follow, connect, message, post, etc.)
    - Links all data together like Facebook notifications
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  content text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (
    type IN (
      'follow',
      'connection_request',
      'connection_accepted',
      'message',
      'post_like',
      'post_comment',
      'community_invite',
      'community_post',
      'community_join',
      'event_invite',
      'cofounder_match',
      'profile_view'
    )
  ),
  CONSTRAINT notifications_entity_type_check CHECK (
    entity_type IN ('user', 'post', 'community', 'event', 'message', 'connection')
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);