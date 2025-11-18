/*
  # Fix Community RLS Policies

  This migration fixes the infinite recursion issue in community_members policies
  by simplifying the policy logic and removing circular dependencies.

  ## Changes
  - Drop and recreate community_members policies with simpler logic
  - Simplify communities SELECT policy to avoid recursion
  - Ensure policies work correctly without circular references

  ## Notes
  - Policies now check membership more efficiently
  - Removed nested subqueries that caused recursion
*/

DROP POLICY IF EXISTS "Members can view community memberships" ON community_members;
DROP POLICY IF EXISTS "Users can join communities" ON community_members;
DROP POLICY IF EXISTS "Users can leave communities" ON community_members;

DROP POLICY IF EXISTS "Anyone can view public communities" ON communities;

CREATE POLICY "Anyone can view public communities"
  ON communities FOR SELECT
  TO authenticated
  USING (is_private = false);

CREATE POLICY "Members can view private communities"
  ON communities FOR SELECT
  TO authenticated
  USING (
    is_private = true AND
    id IN (
      SELECT community_id FROM community_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view all community memberships"
  ON community_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join communities"
  ON community_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
  ON community_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
