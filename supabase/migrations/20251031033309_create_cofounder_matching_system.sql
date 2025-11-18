/*
  # Co-founder Matching System

  1. New Tables
    - `cofounder_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `looking_for_cofounder` (boolean) - actively looking or not
      - `startup_idea` (text) - brief description of their startup idea
      - `role_seeking` (text[]) - roles they're looking for (CTO, CMO, etc.)
      - `industry` (text) - industry/sector
      - `stage` (text) - idea, MVP, launched, etc.
      - `commitment` (text) - full-time, part-time, etc.
      - `location` (text) - location preference
      - `remote_ok` (boolean) - open to remote co-founders
      - `equity_split` (text) - equity expectations
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `cofounder_skills`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references cofounder_profiles)
      - `skill` (text)
      - `level` (text) - beginner, intermediate, expert

    - `cofounder_interests`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references cofounder_profiles)
      - `interest` (text)

    - `cofounder_matches`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `matched_user_id` (uuid, references auth.users)
      - `status` (text) - pending, accepted, rejected
      - `message` (text) - introduction message
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can read all public profiles
    - Users can only modify their own profile
    - Users can manage their own match requests
*/

CREATE TABLE IF NOT EXISTS cofounder_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  looking_for_cofounder boolean DEFAULT true,
  startup_idea text,
  role_seeking text[] DEFAULT '{}',
  industry text,
  stage text,
  commitment text,
  location text,
  remote_ok boolean DEFAULT true,
  equity_split text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cofounder_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES cofounder_profiles ON DELETE CASCADE NOT NULL,
  skill text NOT NULL,
  level text NOT NULL DEFAULT 'intermediate',
  UNIQUE(profile_id, skill)
);

CREATE TABLE IF NOT EXISTS cofounder_interests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES cofounder_profiles ON DELETE CASCADE NOT NULL,
  interest text NOT NULL,
  UNIQUE(profile_id, interest)
);

CREATE TABLE IF NOT EXISTS cofounder_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  matched_user_id uuid REFERENCES auth.users NOT NULL,
  status text DEFAULT 'pending',
  message text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, matched_user_id)
);

ALTER TABLE cofounder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cofounder_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cofounder profiles"
  ON cofounder_profiles
  FOR SELECT
  TO authenticated
  USING (looking_for_cofounder = true);

CREATE POLICY "Users can view own profile"
  ON cofounder_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
  ON cofounder_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON cofounder_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view skills of active profiles"
  ON cofounder_skills
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.id = profile_id
      AND (cofounder_profiles.looking_for_cofounder = true OR cofounder_profiles.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own skills"
  ON cofounder_skills
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.id = profile_id
      AND cofounder_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view interests of active profiles"
  ON cofounder_interests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.id = profile_id
      AND (cofounder_profiles.looking_for_cofounder = true OR cofounder_profiles.user_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own interests"
  ON cofounder_interests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cofounder_profiles
      WHERE cofounder_profiles.id = profile_id
      AND cofounder_profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their match requests"
  ON cofounder_matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = matched_user_id);

CREATE POLICY "Users can create match requests"
  ON cofounder_matches
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update received match requests"
  ON cofounder_matches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = matched_user_id)
  WITH CHECK (auth.uid() = matched_user_id);

CREATE POLICY "Users can delete own match requests"
  ON cofounder_matches
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);