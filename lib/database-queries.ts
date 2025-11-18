import { supabase } from './supabase';

export interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  share_count: number;
  shared_post_id: string | null;
  author?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  current_company: string | null;
  role: string | null;
  industry: string | null;
  years_experience: number | null;
  skills: string[] | null;
  what_im_working_on: string | null;
  looking_for: string[] | null;
  linkedin_url: string | null;
  twitter_handle: string | null;
  website_url: string | null;
  profile_completed: boolean;
  profile_views_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  updated_at: string;
  requester?: Profile;
  recipient?: Profile;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  media_type: string | null;
  created_at: string;
  read: boolean;
  sender?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
  receiver?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  category: string;
  privacy: 'public' | 'private';
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_member?: boolean;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  event_type: 'virtual' | 'in-person' | 'hybrid';
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_link: string | null;
  image_url: string | null;
  created_by: string;
  max_attendees: number | null;
  created_at: string;
  updated_at: string;
  attendee_count?: number;
  is_attending?: boolean;
  organizer?: Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;
}

export async function fetchPosts(limit = 50, offset = 0): Promise<Post[]> {
  console.log('[DB] Fetching posts, limit:', limit, 'offset:', offset);

  try {
    const { data, error} = await supabase
      .from('posts')
      .select(`
        id,
        author_id,
        content,
        image_url,
        video_url,
        media_type,
        created_at,
        likes_count,
        comments_count,
        share_count,
        shared_post_id,
        author:profiles!posts_author_id_fkey(full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[DB] Error fetching posts:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log('[DB] Fetched posts successfully:', {
      count: data?.length || 0,
      firstPost: data?.[0]?.id,
    });

    return (data || []) as unknown as Post[];
  } catch (error: any) {
    console.error('[DB] Failed to fetch posts:', {
      message: error.message,
      stack: error.stack,
    });
    return [];
  }
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  console.log('[DB] Fetching profile for user:', userId);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[DB] Error fetching profile:', error);
      throw error;
    }

    console.log('[DB] Fetched profile:', data?.full_name || 'not found');
    return data;
  } catch (error) {
    console.error('[DB] Failed to fetch profile:', error);
    return null;
  }
}

export async function fetchConnections(userId: string): Promise<Connection[]> {
  console.log('[DB] Fetching connections for user:', userId);

  // SECURITY: Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('[DB] Invalid user ID format');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('connections')
      .select(`
        *,
        requester:profiles!connections_requester_id_fkey(id, full_name, avatar_url, headline),
        recipient:profiles!connections_recipient_id_fkey(id, full_name, avatar_url, headline)
      `)
      // SECURITY: Safe - userId validated as UUID above, Supabase PostgREST also validates
      .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching connections:', error);
      throw error;
    }

    console.log('[DB] Fetched connections:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[DB] Failed to fetch connections:', error);
    return [];
  }
}

export async function fetchMessages(userId: string, otherUserId: string): Promise<Message[]> {
  console.log('[DB] Fetching messages between:', userId, 'and', otherUserId);

  // SECURITY: Validate UUID formats to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId) || !uuidRegex.test(otherUserId)) {
    console.error('[DB] Invalid user ID format');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url),
        receiver:profiles!messages_receiver_id_fkey(id, full_name, avatar_url)
      `)
      // SECURITY: Safe - both IDs validated as UUIDs above, Supabase PostgREST also validates
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${userId})`)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('[DB] Error fetching messages:', error);
      throw error;
    }

    console.log('[DB] Fetched messages:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[DB] Failed to fetch messages:', error);
    return [];
  }
}

export async function fetchConversations(userId: string): Promise<any[]> {
  console.log('[DB] Fetching conversations for user:', userId);

  // SECURITY: Validate UUID format to prevent injection
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    console.error('[DB] Invalid user ID format');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id,
        sender_id,
        receiver_id,
        content,
        created_at,
        read,
        sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url),
        receiver:profiles!messages_receiver_id_fkey(id, full_name, avatar_url)
      `)
      // SECURITY: Safe - userId validated as UUID above, Supabase PostgREST also validates
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[DB] Error fetching conversations:', error);
      throw error;
    }

    const conversationsMap = new Map<string, any>();

    data?.forEach((message: any) => {
      const otherUserId = message.sender_id === userId ? message.receiver_id : message.sender_id;
      const otherUser = message.sender_id === userId ? message.receiver : message.sender;

      if (!conversationsMap.has(otherUserId) ||
          new Date(message.created_at) > new Date(conversationsMap.get(otherUserId).lastMessage.created_at)) {
        conversationsMap.set(otherUserId, {
          userId: otherUserId,
          user: otherUser,
          lastMessage: message,
          unreadCount: message.receiver_id === userId && !message.read ? 1 : 0,
        });
      } else if (message.receiver_id === userId && !message.read) {
        const conv = conversationsMap.get(otherUserId);
        conv.unreadCount++;
      }
    });

    const conversations = Array.from(conversationsMap.values());
    console.log('[DB] Fetched conversations:', conversations.length);
    return conversations;
  } catch (error) {
    console.error('[DB] Failed to fetch conversations:', error);
    return [];
  }
}

export async function fetchCommunities(userId?: string): Promise<Community[]> {
  console.log('[DB] Fetching communities, userId:', userId);

  try {
    const { data, error } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[DB] Error fetching communities:', error);
      throw error;
    }

    if (userId && data) {
      const communitiesWithMembership = await Promise.all(
        data.map(async (community) => {
          const { count } = await supabase
            .from('community_members')
            .select('*', { count: 'exact', head: true })
            .eq('community_id', community.id);

          const { data: memberData } = await supabase
            .from('community_members')
            .select('id')
            .eq('community_id', community.id)
            .eq('user_id', userId)
            .maybeSingle();

          return {
            ...community,
            member_count: count || 0,
            is_member: !!memberData,
          };
        })
      );

      console.log('[DB] Fetched communities with membership:', communitiesWithMembership.length);
      return communitiesWithMembership;
    }

    console.log('[DB] Fetched communities:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[DB] Failed to fetch communities:', error);
    return [];
  }
}

export async function fetchEvents(userId?: string): Promise<Event[]> {
  console.log('[DB] Fetching events, userId:', userId);

  try {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        organizer:profiles!events_created_by_fkey(id, full_name, avatar_url)
      `)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error('[DB] Error fetching events:', error);
      throw error;
    }

    if (userId && data) {
      const eventsWithAttendance = await Promise.all(
        data.map(async (event) => {
          const { count } = await supabase
            .from('event_attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          const { data: attendeeData } = await supabase
            .from('event_attendees')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', userId)
            .maybeSingle();

          return {
            ...event,
            attendee_count: count || 0,
            is_attending: !!attendeeData,
          };
        })
      );

      console.log('[DB] Fetched events with attendance:', eventsWithAttendance.length);
      return eventsWithAttendance;
    }

    console.log('[DB] Fetched events:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('[DB] Failed to fetch events:', error);
    return [];
  }
}
