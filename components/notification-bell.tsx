'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { StorageAvatar } from '@/components/storage-avatar';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification
} from '@/lib/notifications';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    stage: string | null;
  };
}

export function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
      loadUnreadCount();

      console.log('[NotificationBell] Setting up realtime subscription');

      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            console.log('[NotificationBell] New notification:', payload.new);

            // Fetch complete notification with actor info
            const { data: newNotification } = await supabase
              .from('notifications')
              .select(`
                *,
                actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url, stage)
              `)
              .eq('id', payload.new.id)
              .single();

            if (newNotification) {
              // Add to top of list
              setNotifications((prev) => [newNotification as Notification, ...prev]);
              setUnreadCount((prev) => prev + 1);

              // Optional: Play notification sound
              try {
                const audio = new Audio('/notification-sound.mp3');
                audio.volume = 0.3;
                audio.play().catch(e => console.log('Could not play sound:', e));
              } catch (e) {
                console.log('Audio notification error:', e);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[NotificationBell] Notification updated:', payload.new);

            // Update notification in list
            setNotifications((prev) =>
              prev.map((notif) =>
                notif.id === payload.new.id ? { ...notif, ...payload.new } : notif
              )
            );

            // Update unread count
            if (payload.new.is_read && !payload.old.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[NotificationBell] Notification deleted:', payload.old);

            // Remove from list
            setNotifications((prev) => prev.filter((notif) => notif.id !== payload.old.id));

            // Update unread count if was unread
            if (!payload.old.is_read) {
              setUnreadCount((prev) => Math.max(0, prev - 1));
            }
          }
        )
        .subscribe();

      return () => {
        console.log('[NotificationBell] Cleaning up subscription');
        supabase.removeChannel(channel);
      };
    }
  }, [user?.id]);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getNotifications(user.id, 20);
    setNotifications(data);
    setLoading(false);
  };

  const loadUnreadCount = async () => {
    if (!user) return;
    const count = await getUnreadNotificationCount(user.id);
    setUnreadCount(count);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await markNotificationAsRead(notification.id);
      loadUnreadCount();
    }

    setIsOpen(false);

    // Navigate based on notification type and entity
    switch (notification.type) {
      // User profile related
      case 'follow':
      case 'profile_view':
      case 'cofounder_like':
        if (notification.actor_id) {
          router.push(`/profile/${notification.actor_id}`);
        }
        break;

      // Connection related
      case 'connection_request':
      case 'connection_accepted':
        router.push('/network');
        break;

      // Post related - navigate to specific post
      case 'post_like':
      case 'post_share':
      case 'post_mention':
        if (notification.entity_id) {
          router.push(`/post/${notification.entity_id}`);
        } else {
          router.push('/feed');
        }
        break;

      // Comment related - navigate to post with comment highlighted
      case 'post_comment':
      case 'comment_mention':
      case 'comment_reply':
        if (notification.entity_id) {
          // entity_id should be the post_id for comments
          // We can add a comment ID as a query parameter if available
          router.push(`/post/${notification.entity_id}`);
        } else {
          router.push('/feed');
        }
        break;

      // Community related
      case 'community_post':
      case 'community_join':
      case 'community_invite':
      case 'community_mention':
        if (notification.entity_id) {
          router.push(`/communities/${notification.entity_id}`);
        } else {
          router.push('/communities');
        }
        break;

      // Event related - navigate to specific event
      case 'event_invite':
      case 'event_rsvp':
      case 'event_reminder':
        if (notification.entity_id) {
          router.push(`/events`);
        } else {
          router.push('/events');
        }
        break;

      // Cofounder matching related
      case 'cofounder_match':
      case 'cofounder_message':
        // For cofounder messages, we need to find the match ID
        if (notification.actor_id && user) {
          // SECURITY: Safe - user.id and notification.actor_id are UUIDs from Supabase Auth/DB
          // Supabase PostgREST validates UUID format and rejects invalid input
          const { data: match } = await supabase
            .from('cofounder_matches')
            .select('id')
            .or(`and(user_id.eq.${user.id},matched_user_id.eq.${notification.actor_id}),and(user_id.eq.${notification.actor_id},matched_user_id.eq.${user.id})`)
            .eq('status', 'accepted')
            .maybeSingle();

          if (match) {
            router.push(`/cofounder-match/chat/${match.id}`);
          } else {
            router.push('/cofounder-match');
          }
        } else {
          router.push('/cofounder-match');
        }
        break;

      // Message related - open specific conversation
      case 'message':
      case 'direct_message':
        if (notification.entity_id) {
          // entity_id contains the conversation/room ID
          router.push(`/messages`);
        } else if (notification.actor_id) {
          // If no conversation ID, go to messages and it will create/find conversation
          router.push('/messages');
        } else {
          router.push('/messages');
        }
        break;

      // Call related
      case 'call_invite':
      case 'missed_call':
        if (notification.entity_id) {
          router.push(`/call/${notification.entity_id}`);
        } else {
          router.push('/messages');
        }
        break;

      default:
        // Default to feed
        router.push('/feed');
    }
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsAsRead(user.id);
    loadNotifications();
    loadUnreadCount();
  };

  const handleDelete = async (e: React.MouseEvent, notificationId: string) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
    loadNotifications();
    loadUnreadCount();
  };

  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      follow: '👥',
      connection_request: '🤝',
      connection_accepted: '✅',
      message: '💬',
      post_like: '❤️',
      post_comment: '💭',
      post_share: '🔄',
      post_mention: '🏷️',
      comment_mention: '🏷️',
      community_invite: '🏘️',
      community_post: '📝',
      community_join: '🎉',
      community_mention: '🏷️',
      event_invite: '📅',
      event_rsvp: '✓',
      event_reminder: '⏰',
      cofounder_match: '🚀',
      cofounder_like: '💚',
      cofounder_message: '💬',
      profile_view: '👀'
    };
    return iconMap[type] || '🔔';
  };

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-gray-300 hover:text-amber-400 hover:bg-gray-900"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 border-0">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 bg-gray-900 border-gray-800 p-0"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-lg font-semibold text-gray-100">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-amber-400 hover:text-amber-300 hover:bg-gray-800"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[500px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-gray-600 mb-3" />
              <p className="text-gray-400 text-center">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-800 cursor-pointer transition-colors ${
                    !notification.is_read ? 'bg-gray-800/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <StorageAvatar
                        src={notification.actor?.avatar_url || undefined}
                        alt={notification.actor?.full_name || 'User'}
                        fallback={notification.actor?.full_name
                          ?.split(' ')
                          .map((n) => n[0])
                          .join('') || '?'}
                        className="h-10 w-10 border-2 border-amber-500"
                      />
                      <div className="absolute -bottom-1 -right-1 text-lg">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          notification.is_read ? 'text-gray-400' : 'text-gray-200 font-medium'
                        }`}
                      >
                        {notification.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true
                        })}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(e, notification.id)}
                      className="text-gray-500 hover:text-red-400 hover:bg-gray-800 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-gray-800">
            <Button
              variant="ghost"
              className="w-full text-amber-400 hover:text-amber-300 hover:bg-gray-800"
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
