/*
  # Create Co-founder Call Requests System

  1. New Tables
    - `cofounder_call_requests`
      - `id` (uuid, primary key)
      - `match_id` (uuid, references cofounder_matches)
      - `caller_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `call_type` (text: 'video' or 'voice')
      - `status` (text: 'pending', 'accepted', 'rejected', 'timeout', 'cancelled')
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)
      - `answered_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on `cofounder_call_requests` table
    - Add policies for creating, viewing, and updating call requests
*/

CREATE TABLE IF NOT EXISTS cofounder_call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES cofounder_matches(id) ON DELETE CASCADE NOT NULL,
  caller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('video', 'voice')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'timeout', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 seconds'),
  answered_at timestamptz
);

ALTER TABLE cofounder_call_requests ENABLE ROW LEVEL SECURITY;

-- Users can create call requests
CREATE POLICY "Users can create call requests"
  ON cofounder_call_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

-- Users can view call requests they're part of
CREATE POLICY "Users can view their call requests"
  ON cofounder_call_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Receivers can update call requests (accept/reject)
CREATE POLICY "Receivers can update call requests"
  ON cofounder_call_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Callers can cancel their own pending call requests
CREATE POLICY "Callers can cancel their call requests"
  ON cofounder_call_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id AND status = 'pending')
  WITH CHECK (auth.uid() = caller_id AND status = 'cancelled');

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_call_requests_receiver_status 
  ON cofounder_call_requests(receiver_id, status);

CREATE INDEX IF NOT EXISTS idx_call_requests_caller_status 
  ON cofounder_call_requests(caller_id, status);

-- Function to auto-timeout expired call requests
CREATE OR REPLACE FUNCTION timeout_expired_call_requests()
RETURNS void AS $$
BEGIN
  UPDATE cofounder_call_requests
  SET status = 'timeout'
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;