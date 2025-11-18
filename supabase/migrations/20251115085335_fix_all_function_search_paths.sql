-- Fix search_path for all trigger functions to improve security
-- This prevents search_path manipulation attacks

-- Fix update_call_request_updated_at function
CREATE OR REPLACE FUNCTION update_call_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix timeout_expired_call_requests function
CREATE OR REPLACE FUNCTION timeout_expired_call_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.user_call_requests
  SET status = 'timeout'
  WHERE status = 'pending'
    AND created_at < (now() - interval '1 minute');
END;
$$;

-- Fix update_post_likes_count function
CREATE OR REPLACE FUNCTION update_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix update_comment_updated_at function
CREATE OR REPLACE FUNCTION update_comment_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_community_member_count function
CREATE OR REPLACE FUNCTION update_community_member_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities
    SET member_count = member_count + 1
    WHERE id = NEW.community_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities
    SET member_count = GREATEST(0, member_count - 1)
    WHERE id = OLD.community_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix update_replies_count_on_insert function
CREATE OR REPLACE FUNCTION update_replies_count_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    UPDATE public.post_comments
    SET replies_count = replies_count + 1
    WHERE id = NEW.parent_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix update_replies_count_on_delete function
CREATE OR REPLACE FUNCTION update_replies_count_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.parent_id IS NOT NULL THEN
    UPDATE public.post_comments
    SET replies_count = GREATEST(0, replies_count - 1)
    WHERE id = OLD.parent_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix check_single_active_call function
CREATE OR REPLACE FUNCTION check_single_active_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_call_requests
    WHERE (caller_id = NEW.caller_id OR callee_id = NEW.caller_id OR caller_id = NEW.callee_id OR callee_id = NEW.callee_id)
      AND status = 'active'
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'User already has an active call';
  END IF;
  RETURN NEW;
END;
$$;