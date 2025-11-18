/*
  # Create Connections and Network System

  This migration implements a comprehensive networking system for entrepreneurs to connect and follow each other.

  ## 1. New Tables
    
    ### `connections`
    - `id` (uuid, primary key) - Unique identifier for the connection request
    - `requester_id` (uuid) - User who sent the connection request
    - `recipient_id` (uuid) - User who received the connection request
    - `status` (text) - Status of connection: 'pending', 'accepted', 'rejected'
    - `created_at` (timestamptz) - When the request was sent
    - `updated_at` (timestamptz) - When the status was last changed
    - Unique constraint on (requester_id, recipient_id) to prevent duplicate requests
    
    ### `follows`
    - `id` (uuid, primary key) - Unique identifier for the follow relationship
    - `follower_id` (uuid) - User who is following
    - `following_id` (uuid) - User being followed
    - `created_at` (timestamptz) - When the follow relationship was created
    - Unique constraint on (follower_id, following_id) to prevent duplicate follows

  ## 2. Security
    
    ### Connections Table RLS Policies
    - Enable RLS on `connections` table
    - Users can view their own sent requests (as requester)
    - Users can view their own received requests (as recipient)
    - Users can create connection requests (cannot request to self)
    - Users can update their own received requests (accept/reject)
    - Users can delete their own sent requests (cancel)
    
    ### Follows Table RLS Policies
    - Enable RLS on `follows` table
    - Anyone authenticated can view follow relationships
    - Users can create follows (cannot follow self)
    - Users can delete their own follows (unfollow)

  ## 3. Important Notes
    - Check constraints prevent self-connections and self-follows
    - Status constraint ensures only valid statuses are used
    - Indexes on foreign keys for efficient querying
    - Cascading deletes if users are removed
*/

CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT connections_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT connections_no_self_connect CHECK (requester_id != recipient_id),
  CONSTRAINT connections_unique_pair UNIQUE (requester_id, recipient_id)
);

CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT follows_no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT follows_unique_pair UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON connections(requester_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON connections(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sent connection requests"
  ON connections FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id);

CREATE POLICY "Users can view received connection requests"
  ON connections FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can create connection requests"
  ON connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id AND requester_id != recipient_id);

CREATE POLICY "Users can update received connection requests"
  ON connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Users can delete sent connection requests"
  ON connections FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id);

CREATE POLICY "Anyone can view follows"
  ON follows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create follows"
  ON follows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = follower_id AND follower_id != following_id);

CREATE POLICY "Users can delete own follows"
  ON follows FOR DELETE
  TO authenticated
  USING (auth.uid() = follower_id);
