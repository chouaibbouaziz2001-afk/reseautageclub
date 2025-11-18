/*
  # Simplify Remaining Community Policies

  This migration simplifies the remaining policies to prevent any recursion issues.

  ## Changes
  - Simplify chat messages policies
  - Simplify community posts policies
  - Simplify community calls policies
  - All policies now use simpler subquery patterns

  ## Notes
  - Avoids complex nested EXISTS clauses
  - Uses direct subquery checks instead
*/

DROP POLICY IF EXISTS "Members can view chat messages in their communities" ON community_chat_messages;
DROP POLICY IF EXISTS "Members can send chat messages in their communities" ON community_chat_messages;

DROP POLICY IF EXISTS "Members can view posts in their communities" ON community_posts;
DROP POLICY IF EXISTS "Members can create posts in their communities" ON community_posts;

DROP POLICY IF EXISTS "Members can view calls in their communities" ON community_calls;
DROP POLICY IF EXISTS "Only admins can create calls" ON community_calls;

DROP POLICY IF EXISTS "Members can view call participants" ON community_call_participants;
DROP POLICY IF EXISTS "Members can join calls in their communities" ON community_call_participants;

CREATE POLICY "Members can view chat messages in their communities"
  ON community_chat_messages FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send chat messages in their communities"
  ON community_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view posts in their communities"
  ON community_posts FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can create posts in their communities"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can view calls in their communities"
  ON community_calls FOR SELECT
  TO authenticated
  USING (
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can create calls"
  ON community_calls FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = creator_id AND
    community_id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Members can view call participants"
  ON community_call_participants FOR SELECT
  TO authenticated
  USING (
    call_id IN (
      SELECT id FROM community_calls
      WHERE community_id IN (
        SELECT community_id FROM community_members
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Members can join calls in their communities"
  ON community_call_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    call_id IN (
      SELECT id FROM community_calls
      WHERE community_id IN (
        SELECT community_id FROM community_members
        WHERE user_id = auth.uid()
      )
    )
  );
