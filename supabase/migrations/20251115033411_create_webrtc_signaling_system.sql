/*
  # Create WebRTC Signaling System

  1. New Tables
    - `call_signaling`
      - `id` (uuid, primary key)
      - `call_id` (uuid, references call_requests)
      - `user_id` (uuid, references profiles)
      - `signal_type` (text: 'offer', 'answer', 'ice_candidate')
      - `signal_data` (jsonb - stores SDP or ICE candidate data)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `call_signaling` table
    - Both participants can read and write signaling data
    - Enable Realtime for instant signal exchange

  3. Important Notes
    - Used for exchanging WebRTC connection data between call participants
    - Stores SDP offers/answers and ICE candidates
    - Realtime enabled for instant peer-to-peer connection establishment
*/

-- Create call_signaling table
CREATE TABLE IF NOT EXISTS call_signaling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid REFERENCES call_requests(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice_candidate')),
  signal_data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE call_signaling ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert signaling data for their calls
CREATE POLICY "Users can create signaling data for their calls"
  ON call_signaling FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM call_requests
      WHERE id = call_signaling.call_id
        AND (caller_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

-- Policy: Users can read signaling data for their calls
CREATE POLICY "Users can read signaling data for their calls"
  ON call_signaling FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM call_requests
      WHERE id = call_signaling.call_id
        AND (caller_id = auth.uid() OR receiver_id = auth.uid())
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_signaling_call_id 
  ON call_signaling(call_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_call_signaling_user_id 
  ON call_signaling(user_id);

-- Enable Realtime for instant signaling
ALTER PUBLICATION supabase_realtime ADD TABLE call_signaling;