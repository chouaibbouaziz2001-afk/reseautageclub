/*
  # Fix Mutable Search Path Security Vulnerability

  1. Security Fix
    - Add `SET search_path = ''` to all 21 database functions
    - Prevents SQL injection attacks via search path manipulation
    - Ensures functions use fully qualified names for database objects

  2. Functions Updated
    - start_live_event
    - end_live_event
    - increment_comment_likes_count
    - decrement_comment_likes_count
    - increment_replies_count
    - decrement_replies_count
    - check_single_active_call
    - update_replies_count_on_insert
    - update_replies_count_on_delete
    - update_comment_updated_at
    - sync_all_profile_view_counts
    - timeout_expired_call_requests
    - increment_workshop_views
    - update_updated_at_column
    - update_community_member_count
    - create_user_room
    - increment_profile_view_count
    - get_common_connections
    - get_common_followers
    - increment_share_count
    - handle_new_user

  3. Security Impact
    - Eliminates mutable search path vulnerability
    - Each function now has secure, immutable search path
    - Complies with Supabase security best practices
*/

-- Fix community member count function
ALTER FUNCTION update_community_member_count() SET search_path = '';

-- Fix user room creation function
ALTER FUNCTION create_user_room() SET search_path = '';

-- Fix profile view functions
ALTER FUNCTION increment_profile_view_count() SET search_path = '';
ALTER FUNCTION sync_all_profile_view_counts() SET search_path = '';

-- Fix connection functions (2 uuid parameters each)
ALTER FUNCTION get_common_connections(uuid, uuid) SET search_path = '';
ALTER FUNCTION get_common_followers(uuid, uuid) SET search_path = '';

-- Fix share count function
ALTER FUNCTION increment_share_count(uuid) SET search_path = '';

-- Fix admin system functions
ALTER FUNCTION update_updated_at_column() SET search_path = '';

-- Fix handle new user function
ALTER FUNCTION handle_new_user() SET search_path = '';

-- Fix live event functions
ALTER FUNCTION start_live_event(uuid) SET search_path = '';
ALTER FUNCTION end_live_event(uuid) SET search_path = '';
ALTER FUNCTION check_single_active_call() SET search_path = '';

-- Fix comment system functions
ALTER FUNCTION increment_comment_likes_count(uuid) SET search_path = '';
ALTER FUNCTION decrement_comment_likes_count(uuid) SET search_path = '';
ALTER FUNCTION increment_replies_count(uuid) SET search_path = '';
ALTER FUNCTION decrement_replies_count(uuid) SET search_path = '';
ALTER FUNCTION update_replies_count_on_insert() SET search_path = '';
ALTER FUNCTION update_replies_count_on_delete() SET search_path = '';
ALTER FUNCTION update_comment_updated_at() SET search_path = '';

-- Fix call request function
ALTER FUNCTION timeout_expired_call_requests() SET search_path = '';

-- Fix workshop views function
ALTER FUNCTION increment_workshop_views() SET search_path = '';