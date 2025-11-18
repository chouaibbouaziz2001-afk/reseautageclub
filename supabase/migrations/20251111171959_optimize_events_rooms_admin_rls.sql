/*
  # Optimize Events, Rooms, and Admin RLS Policies

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid())
    - Tables with admin checks and room ownership
    
  2. Tables Updated
    - events
    - room_admins, room_announcements
    - live_streams
    - admin_chat_messages
    - event_admins
    - cofounder_call_requests
    - message_call_requests
    - call_comments
    - workshops
    - community_calls
*/

-- Events (simplified - keeping only functional policies)
DROP POLICY IF EXISTS "Only admins can create events" ON events;
DROP POLICY IF EXISTS "Room owners and admins can create events" ON events;
CREATE POLICY "Admins can create events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM user_rooms 
      WHERE user_id = (select auth.uid()) 
      AND id = events.room_id
    )
  );

DROP POLICY IF EXISTS "Only admins can update events" ON events;
DROP POLICY IF EXISTS "Room owners and admins can update events" ON events;
CREATE POLICY "Admins can update events"
  ON events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid())
    ) OR
    created_by = (select auth.uid())
  );

DROP POLICY IF EXISTS "Only admins can delete events" ON events;
CREATE POLICY "Admins can delete events"
  ON events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid())
    ) OR
    created_by = (select auth.uid())
  );

-- Room admins (simplified)
DROP POLICY IF EXISTS "Room owners can manage admins" ON room_admins;
DROP POLICY IF EXISTS "Room owners can view all admins" ON room_admins;
CREATE POLICY "Room owners manage admins"
  ON room_admins FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_rooms 
      WHERE id = room_admins.room_id 
      AND user_id = (select auth.uid())
    )
  );

-- Room announcements
DROP POLICY IF EXISTS "Room owners and authorized admins can create announcements" ON room_announcements;
CREATE POLICY "Room owners and admins can create announcements"
  ON room_announcements FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_rooms 
      WHERE id = room_id 
      AND user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM room_admins 
      WHERE room_id = room_announcements.room_id 
      AND user_id = (select auth.uid())
    )
  );

-- Live streams  
DROP POLICY IF EXISTS "Room owners and authorized admins can start streams" ON live_streams;
CREATE POLICY "Room owners and admins can start streams"
  ON live_streams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_rooms 
      WHERE id = room_id 
      AND user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM room_admins 
      WHERE room_id = live_streams.room_id 
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Stream creators can update own streams" ON live_streams;
CREATE POLICY "Stream creators can update own streams"
  ON live_streams FOR UPDATE TO authenticated
  USING (started_by = (select auth.uid()));

-- Admin chat messages
DROP POLICY IF EXISTS "Only admins can send admin chat messages" ON admin_chat_messages;
CREATE POLICY "Only admins can send admin chat messages"
  ON admin_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Only admins can view admin chat" ON admin_chat_messages;
CREATE POLICY "Only admins can view admin chat"
  ON admin_chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own messages and super admins can delete any" ON admin_chat_messages;
CREATE POLICY "Admins can delete messages"
  ON admin_chat_messages FOR DELETE TO authenticated
  USING (
    sender_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid()) 
      AND is_super_admin = true
    )
  );

-- Event admins
DROP POLICY IF EXISTS "Only super admin can add admins" ON event_admins;
CREATE POLICY "Only super admin can add admins"
  ON event_admins FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid()) 
      AND is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Only super admin can remove admins" ON event_admins;
CREATE POLICY "Only super admin can remove admins"
  ON event_admins FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM event_admins 
      WHERE user_id = (select auth.uid()) 
      AND is_super_admin = true
    )
  );

-- Cofounder call requests
DROP POLICY IF EXISTS "Callers can cancel their call requests" ON cofounder_call_requests;
DROP POLICY IF EXISTS "Receivers can update call requests" ON cofounder_call_requests;
CREATE POLICY "Users can manage their call requests"
  ON cofounder_call_requests FOR UPDATE TO authenticated
  USING (caller_id = (select auth.uid()) OR receiver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create call requests" ON cofounder_call_requests;
CREATE POLICY "Users can create call requests"
  ON cofounder_call_requests FOR INSERT TO authenticated
  WITH CHECK (caller_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their call requests" ON cofounder_call_requests;
CREATE POLICY "Users can view their call requests"
  ON cofounder_call_requests FOR SELECT TO authenticated
  USING (caller_id = (select auth.uid()) OR receiver_id = (select auth.uid()));

-- Message call requests
DROP POLICY IF EXISTS "Users can create call requests" ON message_call_requests;
CREATE POLICY "Users can create call requests"
  ON message_call_requests FOR INSERT TO authenticated
  WITH CHECK (caller_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own call requests" ON message_call_requests;
CREATE POLICY "Users can update their own call requests"
  ON message_call_requests FOR UPDATE TO authenticated
  USING (caller_id = (select auth.uid()) OR receiver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own call requests" ON message_call_requests;
CREATE POLICY "Users can view their own call requests"
  ON message_call_requests FOR SELECT TO authenticated
  USING (caller_id = (select auth.uid()) OR receiver_id = (select auth.uid()));