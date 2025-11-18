/*
  # Add Course Favorites and Enhanced Progress Tracking

  1. New Tables
    - `user_course_favorites`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `course_id` (uuid, references community_courses)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on user_course_favorites table
    - Users can only manage their own favorites
    - Users can view their own favorites
*/

-- Create favorites table
CREATE TABLE IF NOT EXISTS user_course_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  course_id uuid REFERENCES community_courses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS
ALTER TABLE user_course_favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own favorites"
  ON user_course_favorites FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add own favorites"
  ON user_course_favorites FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own favorites"
  ON user_course_favorites FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_course_favorites_user ON user_course_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_favorites_course ON user_course_favorites(course_id);
