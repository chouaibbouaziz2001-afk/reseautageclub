import { supabase } from './supabase';

const POST_SELECT_FIELDS = `
  id,
  author_id,
  content,
  image_url,
  video_url,
  audio_url,
  likes_count,
  comments_count,
  share_count,
  created_at,
  shared_post_id,
  author:profiles!community_posts_author_id_fkey(id, full_name, avatar_url)
`;

const MESSAGE_SELECT_FIELDS = `
  id,
  sender_id,
  content,
  media_url,
  media_type,
  created_at,
  is_read
`;

const PROFILE_SELECT_FIELDS = `
  id,
  full_name,
  avatar_url,
  bio,
  stage,
  followers_count,
  connections_count
`;

export async function getOptimizedPosts(limit = 20, offset = 0) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_SELECT_FIELDS)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data || [];
}

export async function getOptimizedPost(postId: string) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_SELECT_FIELDS)
    .eq('id', postId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getOptimizedUserPosts(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from('community_posts')
    .select(POST_SELECT_FIELDS)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getOptimizedMessages(roomId: string, limit = 50) {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT_FIELDS)
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getOptimizedProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT_FIELDS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getOptimizedComments(postId: string, limit = 20) {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`
      id,
      content,
      author_id,
      created_at,
      likes_count,
      parent_comment_id,
      author:profiles!post_comments_author_id_fkey(id, full_name, avatar_url)
    `)
    .eq('post_id', postId)
    .is('parent_comment_id', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getOptimizedNotificationCount(userId: string) {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) throw error;
  return count || 0;
}

export async function getOptimizedCommunities(limit = 20) {
  const { data, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      description,
      image_url,
      member_count,
      is_public
    `)
    .order('member_count', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function prefetchPostData(postId: string) {
  const promises = [
    getOptimizedPost(postId),
    getOptimizedComments(postId, 10)
  ];

  const [post, comments] = await Promise.all(promises);
  return { post, comments };
}
