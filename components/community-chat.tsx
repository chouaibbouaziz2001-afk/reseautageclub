"use client";

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StorageAvatar } from '@/components/storage-avatar';
import { StorageImage } from '@/components/storage-image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, Users, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { LinkifyText } from '@/components/linkify-text';
import { ImageUpload } from '@/components/image-upload';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  stage: string | null;
}

interface CommunityMessage {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  images: string[];
  read_by: string[];
  created_at: string;
  sender?: Profile;
}

interface PresenceState {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  online_at: string;
  typing?: boolean;
}

interface CommunityChatProps {
  communityId: string;
  communityName: string;
}

export function CommunityChat({ communityId, communityName }: CommunityChatProps) {
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { toast } = useToast();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onlineMembers, setOnlineMembers] = useState<PresenceState[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<any>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    loadMessages();
    setupRealtimeSubscription();
    setupPresenceTracking();

    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [communityId, user]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('community_messages')
        .select(`
          *,
          sender:profiles!community_messages_user_id_fkey(id, full_name, avatar_url, stage)
        `)
        .eq('community_id', communityId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) throw error;

      setMessages(data || []);
      setTimeout(() => scrollToBottom(), 100);

      if (data && data.length > 0 && user) {
        const unreadMessageIds = data
          .filter(msg => msg.user_id !== user.id && !msg.read_by.includes(user.id))
          .map(msg => msg.id);

        if (unreadMessageIds.length > 0) {
          for (const messageId of unreadMessageIds) {
            await markMessageAsRead(messageId);
          }
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load chat messages',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`community-chat:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${communityId}`,
        },
        async (payload) => {
          const newMsg = payload.new as CommunityMessage;

          if (newMsg.user_id !== user!.id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, stage')
              .eq('id', newMsg.user_id)
              .maybeSingle();

            const messageWithSender = {
              ...newMsg,
              sender: senderProfile || undefined,
            };

            setMessages((prev) => {
              const exists = prev.some(msg => msg.id === newMsg.id);
              if (exists) return prev;
              return [...prev, messageWithSender];
            });

            setTimeout(() => scrollToBottom(), 100);
            await markMessageAsRead(newMsg.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_messages',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          const deletedId = payload.old.id;
          setMessages((prev) => prev.filter(msg => msg.id !== deletedId));
        }
      )
      .subscribe();

    messageChannelRef.current = channel;
  };

  const setupPresenceTracking = () => {
    if (!user || !profile) return;

    const channel = supabase.channel(`presence:community:${communityId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const members: PresenceState[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            const presence = presences[0] as PresenceState;
            if (presence.user_id && presence.full_name) {
              members.push(presence);
            }
          }
        });

        setOnlineMembers(members);

        const typing = members
          .filter(m => m.typing && m.user_id !== user.id)
          .map(m => m.full_name);
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            full_name: profile.fullName,
            avatar_url: profile.profilePhotoUrl,
            online_at: new Date().toISOString(),
            typing: false,
          });
        }
      });

    presenceChannelRef.current = channel;
  };

  const updateTypingStatus = async (typing: boolean) => {
    if (!presenceChannelRef.current || !user || !profile) return;

    try {
      await presenceChannelRef.current.track({
        user_id: user.id,
        full_name: profile.fullName,
        avatar_url: profile.profilePhotoUrl,
        online_at: new Date().toISOString(),
        typing,
      });
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);

    if (e.target.value.trim() && !isTypingRef.current) {
      isTypingRef.current = true;
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      updateTypingStatus(false);
    }, 2000);
  };

  const markMessageAsRead = async (messageId: string) => {
    if (!user) return;

    try {
      const { data: message } = await supabase
        .from('community_messages')
        .select('read_by')
        .eq('id', messageId)
        .maybeSingle();

      if (message && !message.read_by.includes(user.id)) {
        await supabase
          .from('community_messages')
          .update({
            read_by: [...message.read_by, user.id],
          })
          .eq('id', messageId);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const sendMessage = async (images: string[] = []) => {
    if ((!newMessage.trim() && images.length === 0) || !user || sending) return;

    const messageContent = newMessage.trim();
    const optimisticMessage: CommunityMessage = {
      id: `temp-${Date.now()}`,
      community_id: communityId,
      user_id: user.id,
      content: messageContent,
      images,
      read_by: [user.id],
      created_at: new Date().toISOString(),
      sender: profile ? {
        id: user.id,
        full_name: profile.fullName,
        avatar_url: profile.profilePhotoUrl || null,
        stage: profile.businessStage || null,
      } : undefined,
    };

    setMessages(prev => [...prev, optimisticMessage]);
    setNewMessage('');
    setShowImageUpload(false);
    setTimeout(() => scrollToBottom(), 0);

    if (isTypingRef.current) {
      isTypingRef.current = false;
      updateTypingStatus(false);
    }

    try {
      setSending(true);
      const { data, error } = await supabase
        .from('community_messages')
        .insert({
          community_id: communityId,
          user_id: user.id,
          content: messageContent,
          images,
          read_by: [user.id],
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev =>
        prev.map(msg => msg.id === optimisticMessage.id ? { ...data, sender: optimisticMessage.sender } : msg)
      );
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = () => {
    sendMessage();
  };

  const handleImageUpload = (url: string) => {
    sendMessage([url]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">General Chat</h3>
            <p className="text-xs text-gray-400">{communityName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {onlineMembers.length} online
            </Badge>
          </div>
        </div>

        {onlineMembers.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex -space-x-2">
              {onlineMembers.slice(0, 5).map((member) => (
                <div key={member.user_id} className="relative">
                  <StorageAvatar
                    src={member.avatar_url}
                    fallback={member.full_name.substring(0, 2).toUpperCase()}
                    className="h-6 w-6 border-2 border-gray-900"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-green-500 rounded-full border border-gray-900" />
                </div>
              ))}
            </div>
            {onlineMembers.length > 5 && (
              <span className="text-xs text-gray-400">+{onlineMembers.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-gray-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.user_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[80%] ${isOwn ? 'flex-row-reverse' : ''}`}>
                    {!isOwn && message.sender && (
                      <StorageAvatar
                        src={message.sender.avatar_url}
                        fallback={message.sender.full_name.substring(0, 2).toUpperCase()}
                        className="h-8 w-8 flex-shrink-0"
                      />
                    )}
                    <div>
                      {!isOwn && message.sender && (
                        <p className="text-xs text-gray-400 mb-1 px-1">
                          {message.sender.full_name}
                        </p>
                      )}
                      <div
                        className={`rounded-2xl overflow-hidden ${
                          isOwn
                            ? 'bg-amber-600 text-white'
                            : 'bg-gray-800 text-gray-100'
                        }`}
                      >
                        {message.images && message.images.length > 0 && (
                          <div className="grid grid-cols-1 gap-2 p-2">
                            {message.images.map((img, idx) => (
                              <StorageImage
                                key={idx}
                                src={img}
                                alt={`Shared image ${idx + 1}`}
                                width={300}
                                height={300}
                                className="w-full h-auto rounded-lg"
                                clickable={true}
                              />
                            ))}
                          </div>
                        )}
                        {message.content && (
                          <div className="px-4 py-2">
                            <LinkifyText text={message.content} />
                            <div className="flex items-center gap-2 mt-1">
                              <p className={`text-xs ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </p>
                              {isOwn && message.read_by && message.read_by.length > 1 && (
                                <span className={`text-xs ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                  · Seen by {message.read_by.length - 1}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-xs text-gray-400 italic">
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      <div className="flex-shrink-0 px-4 py-3 border-t border-gray-800 bg-gray-900/50">
        {showImageUpload ? (
          <div className="mb-2">
            <ImageUpload
              onChange={handleImageUpload}
              folder="community-chat"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageUpload(false)}
              className="mt-2"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowImageUpload(true)}
              className="text-gray-400 hover:text-gray-100"
            >
              <ImageIcon className="h-5 w-5" />
            </Button>
            <Input
              value={newMessage}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              disabled={sending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={sending || (!newMessage.trim() && !showImageUpload)}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunityChat;
