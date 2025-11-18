/*
  # Add Profile Views, Followers, and Additional User Data

  1. Changes to Existing Tables
    - Add `phone_number` column to profiles table for user phone numbers
    - Add `profile_views_count` column to profiles table to track profile views
    
  2. New Tables
    - `profile_views`
      - `id` (uuid, primary key)
      - `viewer_id` (uuid, references profiles.id) - user viewing the profile
      - `viewed_profile_id` (uuid, references profiles.id) - profile being viewed
      - `viewed_at` (timestamp)
    
    - `followers`
      - `id` (uuid, primary key)
      - `follower_id` (uuid, references profiles.id) - user who is following
      - `following_id` (uuid, references profiles.id) - user being followed
      - `created_at` (timestamp)
      - Unique constraint on (follower_id, following_id) to prevent duplicates
    
    - `membership_plans`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.id)
      - `plan_type` (text) - free, premium, enterprise
      - `card_last_four` (text) - last 4 digits of payment card
      - `card_brand` (text) - visa, mastercard, etc
      - `expires_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
    - Add policies for viewing public profile information
*/

-- Add phone number and profile views count to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'profile_views_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN profile_views_count integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;
END $$;

-- Create profile views table
CREATE TABLE IF NOT EXISTS profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now()
);

-- Create followers table
CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add unique constraint to prevent duplicate follows
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_follower_following'
  ) THEN
    ALTER TABLE followers ADD CONSTRAINT unique_follower_following UNIQUE (follower_id, following_id);
  END IF;
END $$;

-- Create membership plans table
CREATE TABLE IF NOT EXISTS membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_type text DEFAULT 'free' NOT NULL,
  card_last_four text,
  card_brand text,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_plans ENABLE ROW LEVEL SECURITY;

-- Profile views policies
CREATE POLICY "Users can view their own profile views"
  ON profile_views FOR SELECT
  TO authenticated
  USING (viewed_profile_id = auth.uid());

CREATE POLICY "Authenticated users can create profile views"
  ON profile_views FOR INSERT
  TO authenticated
  WITH CHECK (viewer_id = auth.uid());

-- Followers policies
CREATE POLICY "Users can view all followers"
  ON followers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can follow others"
  ON followers FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow"
  ON followers FOR DELETE
  TO authenticated
  USING (follower_id = auth.uid());

-- Membership plans policies
CREATE POLICY "Users can view their own membership"
  ON membership_plans FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own membership"
  ON membership_plans FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own membership"
  ON membership_plans FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed ON profile_views(viewed_profile_id);
CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_membership_user ON membership_plans(user_id);

-- Function to increment profile view count
CREATE OR REPLACE FUNCTION increment_profile_view_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles 
  SET profile_views_count = profile_views_count + 1
  WHERE id = NEW.viewed_profile_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically increment view count
DROP TRIGGER IF EXISTS trigger_increment_profile_view_count ON profile_views;
CREATE TRIGGER trigger_increment_profile_view_count
  AFTER INSERT ON profile_views
  FOR EACH ROW
  EXECUTE FUNCTION increment_profile_view_count();