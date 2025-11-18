/*
  # Add Delete Message Policies

  1. Changes
    - Add DELETE policies for community_chat_messages table
    - Add DELETE policies for cofounder_messages table  
    - Add DELETE policies for messages table
    - Allow users to delete their own messages
    - Allow community admins to delete messages in their communities
  
  2. Security
    - Users can only delete messages they authored
    - Community admins (creators and moderators) can delete any message in their community
    - Maintains data integrity with proper ownership checks
*/

-- Community chat messages: Users can delete their own messages
CREATE POLICY "Users can delete own community chat messages"
  ON community_chat_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Community chat messages: Community admins can delete any message
CREATE POLICY "Community admins can delete any message"
  ON community_chat_messages
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_chat_messages.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'moderator')
    )
  );

-- Cofounder messages: Users can delete their own messages
CREATE POLICY "Users can delete own cofounder messages"
  ON cofounder_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Regular messages: Users can delete their own messages
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
