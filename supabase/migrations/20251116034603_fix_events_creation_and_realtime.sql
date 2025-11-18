/*
  # Fix Events Creation and Real-Time
  
  1. Enable Realtime on events table
  2. Fix RLS policies for event creation
  3. Add attendee_count column if missing
  4. Ensure proper permissions
*/

-- Enable realtime on events
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;

-- Add attendee_count if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'attendee_count'
  ) THEN
    ALTER TABLE events ADD COLUMN attendee_count integer DEFAULT 0;
  END IF;
END $$;

-- Drop and recreate INSERT policy to allow authenticated users
DROP POLICY IF EXISTS "Admins can create events" ON events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON events;

-- Allow authenticated users to create events
CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Ensure SELECT policy exists for everyone
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Anyone can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

-- Update event_attendees table policies if needed
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_attendees') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can view event attendees" ON event_attendees;
    DROP POLICY IF EXISTS "Users can RSVP to events" ON event_attendees;
    DROP POLICY IF EXISTS "Users can remove their RSVP" ON event_attendees;
    
    -- Create new policies
    CREATE POLICY "Users can view event attendees"
      ON event_attendees FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Users can RSVP to events"
      ON event_attendees FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
    
    CREATE POLICY "Users can remove their RSVP"
      ON event_attendees FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Create function to update attendee count
CREATE OR REPLACE FUNCTION update_event_attendee_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events 
    SET attendee_count = COALESCE(attendee_count, 0) + 1
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events 
    SET attendee_count = GREATEST(COALESCE(attendee_count, 0) - 1, 0)
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger if event_attendees table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_attendees') THEN
    DROP TRIGGER IF EXISTS update_attendee_count_trigger ON event_attendees;
    
    CREATE TRIGGER update_attendee_count_trigger
      AFTER INSERT OR DELETE ON event_attendees
      FOR EACH ROW
      EXECUTE FUNCTION update_event_attendee_count();
  END IF;
END $$;
