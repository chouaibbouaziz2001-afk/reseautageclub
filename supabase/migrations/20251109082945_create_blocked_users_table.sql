/*
  # Create Blocked Users System

  1. New Tables
    - `blocked_users`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - The user who is blocking
      - `blocked_user_id` (uuid, references profiles) - The user being blocked
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, blocked_user_id) to prevent duplicates

  2. Security
    - Enable RLS on `blocked_users` table
    - Add policies for users to:
      - View their own blocked list
      - Add users to their blocked list
      - Remove users from their blocked list
*/

-- Create blocked_users table
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, blocked_user_id)
);

-- Enable RLS
ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own blocked list"
  ON blocked_users FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can block other users"
  ON blocked_users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_id != blocked_user_id);

CREATE POLICY "Users can unblock users"
  ON blocked_users FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_user_id ON blocked_users(blocked_user_id);
