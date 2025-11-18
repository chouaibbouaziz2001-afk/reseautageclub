/*
  # Add Missing Entity Types for Notifications

  1. Updates
    - Drops and recreates the notifications_entity_type_check constraint
    - Adds support for:
      - cofounder (for cofounder matching notifications)
      - comment (for comment-related notifications)
  
  2. Notes
    - Ensures all entity types used by notification helpers are valid
    - Existing notifications are not affected
*/

-- Drop the old constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_entity_type_check;

-- Add the new constraint with all entity types
ALTER TABLE notifications ADD CONSTRAINT notifications_entity_type_check 
  CHECK (entity_type IN (
    'user',
    'post',
    'community',
    'event',
    'message',
    'connection',
    'comment',
    'cofounder'
  ));
