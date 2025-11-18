/*
  # Add Delete Policy for Admin Chat Messages

  1. Security Changes
    - Add DELETE policy for admin_chat_messages table
    - Allow users to delete their own messages
    - Allow super admins to delete any message

  2. Policy Logic
    - Message sender can delete their own message
    - Super admins can delete any message in the admin chat
*/

CREATE POLICY "Users can delete own messages and super admins can delete any"
  ON admin_chat_messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM event_admins
      WHERE user_id = auth.uid()
      AND is_super_admin = true
    )
  );