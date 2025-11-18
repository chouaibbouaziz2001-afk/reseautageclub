import { supabase } from './supabase';

// Helper to extract user mentions from text
export const extractMentions = (text: string): string[] => {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }

  return mentions;
};

export type NotificationType =
  | 'follow'
  | 'connection_request'
  | 'connection_accepted'
  | 'message'
  | 'post_like'
  | 'post_comment'
  | 'post_share'
  | 'post_mention'
  | 'comment_mention'
  | 'community_invite'
  | 'community_post'
  | 'community_join'
  | 'community_mention'
  | 'event_invite'
  | 'event_reminder'
  | 'event_rsvp'
  | 'cofounder_match'
  | 'cofounder_like'
  | 'cofounder_message'
  | 'profile_view';

export type EntityType = 'user' | 'post' | 'community' | 'event' | 'message' | 'connection' | 'comment' | 'cofounder';

interface CreateNotificationParams {
  userId: string;
  actorId: string;
  type: NotificationType;
  content: string;
  entityType?: EntityType;
  entityId?: string;
}

export const createNotification = async ({
  userId,
  actorId,
  type,
  content,
  entityType,
  entityId
}: CreateNotificationParams) => {
  if (userId === actorId) return;

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    actor_id: actorId,
    type,
    content,
    entity_type: entityType,
    entity_id: entityId,
    is_read: false
  });

  if (error) {
    console.error('Error creating notification:', error);
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
  }
};

export const deleteNotification = async (notificationId: string) => {
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId);

  if (error) {
    console.error('Error deleting notification:', error);
  }
};

export const getNotifications = async (userId: string, limit = 20) => {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:actor_id (
        id,
        full_name,
        avatar_url,
        stage
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data || [];
};

export const getUnreadNotificationCount = async (userId: string) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    console.error('Error fetching unread count:', error);
    return 0;
  }

  return count || 0;
};

export const notificationHelpers = {
  follow: async (followerId: string, followedId: string, followerName: string) => {
    await createNotification({
      userId: followedId,
      actorId: followerId,
      type: 'follow',
      content: `${followerName} started following you`,
      entityType: 'user',
      entityId: followerId
    });
  },

  connectionRequest: async (requesterId: string, receiverId: string, requesterName: string) => {
    await createNotification({
      userId: receiverId,
      actorId: requesterId,
      type: 'connection_request',
      content: `${requesterName} sent you a connection request`,
      entityType: 'user',
      entityId: requesterId
    });
  },

  connectionAccepted: async (accepterId: string, requesterId: string, accepterName: string) => {
    await createNotification({
      userId: requesterId,
      actorId: accepterId,
      type: 'connection_accepted',
      content: `${accepterName} accepted your connection request`,
      entityType: 'user',
      entityId: accepterId
    });
  },

  newMessage: async (senderId: string, receiverId: string, senderName: string) => {
    await createNotification({
      userId: receiverId,
      actorId: senderId,
      type: 'message',
      content: `${senderName} sent you a message`,
      entityType: 'message',
      entityId: senderId
    });
  },

  communityPost: async (authorId: string, communityId: string, memberIds: string[], authorName: string, communityName: string) => {
    for (const memberId of memberIds) {
      if (memberId !== authorId) {
        await createNotification({
          userId: memberId,
          actorId: authorId,
          type: 'community_post',
          content: `${authorName} posted in ${communityName}`,
          entityType: 'community',
          entityId: communityId
        });
      }
    }
  },

  communityJoin: async (userId: string, communityId: string, adminIds: string[], userName: string, communityName: string) => {
    for (const adminId of adminIds) {
      if (adminId !== userId) {
        await createNotification({
          userId: adminId,
          actorId: userId,
          type: 'community_join',
          content: `${userName} joined ${communityName}`,
          entityType: 'community',
          entityId: communityId
        });
      }
    }
  },

  profileView: async (viewerId: string, profileId: string, viewerName: string) => {
    await createNotification({
      userId: profileId,
      actorId: viewerId,
      type: 'profile_view',
      content: `${viewerName} viewed your profile`,
      entityType: 'user',
      entityId: viewerId
    });
  },

  postLike: async (likerId: string, postAuthorId: string, postId: string, likerName: string) => {
    await createNotification({
      userId: postAuthorId,
      actorId: likerId,
      type: 'post_like',
      content: `${likerName} liked your post`,
      entityType: 'post',
      entityId: postId
    });
  },

  postComment: async (commenterId: string, postAuthorId: string, postId: string, commenterName: string) => {
    await createNotification({
      userId: postAuthorId,
      actorId: commenterId,
      type: 'post_comment',
      content: `${commenterName} commented on your post`,
      entityType: 'post',
      entityId: postId
    });
  },

  postShare: async (sharerId: string, postAuthorId: string, postId: string, sharerName: string) => {
    await createNotification({
      userId: postAuthorId,
      actorId: sharerId,
      type: 'post_share',
      content: `${sharerName} shared your post`,
      entityType: 'post',
      entityId: postId
    });
  },

  postMention: async (mentionerId: string, mentionedId: string, postId: string, mentionerName: string) => {
    await createNotification({
      userId: mentionedId,
      actorId: mentionerId,
      type: 'post_mention',
      content: `${mentionerName} mentioned you in a post`,
      entityType: 'post',
      entityId: postId
    });
  },

  commentMention: async (mentionerId: string, mentionedId: string, postId: string, mentionerName: string) => {
    await createNotification({
      userId: mentionedId,
      actorId: mentionerId,
      type: 'comment_mention',
      content: `${mentionerName} mentioned you in a comment`,
      entityType: 'post',
      entityId: postId
    });
  },

  eventInvite: async (inviterId: string, invitedId: string, eventId: string, inviterName: string, eventName: string) => {
    await createNotification({
      userId: invitedId,
      actorId: inviterId,
      type: 'event_invite',
      content: `${inviterName} invited you to ${eventName}`,
      entityType: 'event',
      entityId: eventId
    });
  },

  eventRsvp: async (attendeeId: string, hostId: string, eventId: string, attendeeName: string, eventName: string) => {
    await createNotification({
      userId: hostId,
      actorId: attendeeId,
      type: 'event_rsvp',
      content: `${attendeeName} is attending ${eventName}`,
      entityType: 'event',
      entityId: eventId
    });
  },

  cofounderMatch: async (matcherId: string, matchedId: string, matcherName: string) => {
    await createNotification({
      userId: matchedId,
      actorId: matcherId,
      type: 'cofounder_match',
      content: `You matched with ${matcherName}`,
      entityType: 'cofounder',
      entityId: matcherId
    });
  },

  cofounderLike: async (likerId: string, likedId: string, likerName: string) => {
    await createNotification({
      userId: likedId,
      actorId: likerId,
      type: 'cofounder_like',
      content: `${likerName} liked your profile`,
      entityType: 'user',
      entityId: likerId
    });
  },

  cofounderMessage: async (senderId: string, receiverId: string, senderName: string) => {
    await createNotification({
      userId: receiverId,
      actorId: senderId,
      type: 'cofounder_message',
      content: `${senderName} sent you a message`,
      entityType: 'message',
      entityId: senderId
    });
  },

  communityMention: async (mentionerId: string, mentionedId: string, communityId: string, mentionerName: string, communityName: string) => {
    await createNotification({
      userId: mentionedId,
      actorId: mentionerId,
      type: 'community_mention',
      content: `${mentionerName} mentioned you in ${communityName}`,
      entityType: 'community',
      entityId: communityId
    });
  }
};
