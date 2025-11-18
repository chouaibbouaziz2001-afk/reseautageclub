/*
  # Create User-to-User Call Requests System

  1. New Tables
    - `call_requests`
      - `id` (uuid, primary key)
      - `caller_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `call_type` (text: 'video' or 'audio')
      - `status` (text: 'pending', 'accepted', 'declined', 'missed', 'cancelled')
      - `room_id` (text, nullable - for WebRTC room)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `expires_at` (timestamptz - 30 seconds from creation)
      - `answered_at` (timestamptz, nullable)

  2. Security
    - Enable RLS on `call_requests` table
    - Add policies for creating, viewing, and updating call requests
    - Enable Realtime for instant call notifications

  3. Important Notes
    - Realtime must be enabled for instant call notifications
    - Expires in 30 seconds for missed call detection
    - Both caller and receiver can view their calls
    - Only receiver can accept/decline
    - Only caller can cancel pending calls
*/

-- Create call_requests table
CREATE TABLE IF NOT EXISTS call_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  call_type text NOT NULL CHECK (call_type IN ('video', 'audio')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'missed', 'cancelled')),
  room_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 seconds'),
  answered_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE call_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can create call requests
CREATE POLICY "Users can create call requests"
  ON call_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = caller_id);

-- Policy: Users can view call requests they're part of (caller or receiver)
CREATE POLICY "Users can view their call requests"
  ON call_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = caller_id OR auth.uid() = receiver_id);

-- Policy: Receiver can update call requests (accept/decline)
CREATE POLICY "Receiver can update call requests"
  ON call_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- Policy: Caller can cancel their own pending call requests
CREATE POLICY "Caller can cancel pending calls"
  ON call_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = caller_id AND status = 'pending')
  WITH CHECK (auth.uid() = caller_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_requests_receiver_status 
  ON call_requests(receiver_id, status) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_call_requests_caller_status 
  ON call_requests(caller_id, status);

CREATE INDEX IF NOT EXISTS idx_call_requests_created_at 
  ON call_requests(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_call_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_call_requests_updated_at
  BEFORE UPDATE ON call_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_call_request_updated_at();

-- Function to auto-timeout expired call requests
CREATE OR REPLACE FUNCTION timeout_expired_call_requests()
RETURNS void AS $$
BEGIN
  UPDATE call_requests
  SET status = 'missed', updated_at = now()
  WHERE status = 'pending' 
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for call_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE call_requests;
