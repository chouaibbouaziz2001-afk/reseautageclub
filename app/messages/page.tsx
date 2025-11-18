"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StorageAvatar } from '@/components/storage-avatar';
import { StorageImage } from '@/components/storage-image';
import { StorageVideo } from '@/components/storage-video';
import { AudioPlayer } from '@/components/audio-player';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Send, ArrowLeft, Home, Trash2, Image as ImageIcon, Play, Mic, X, Volume2, Link as LinkIcon, MoreVertical, User, Images, Search, Ban, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { createNotification } from '@/lib/notifications';
import { useToast } from '@/hooks/use-toast';
import { LinkifyText } from '@/components/linkify-text';
import { MediaMessageComposer } from '@/components/media-message-composer';
import { uploadToUserMedia } from '@/lib/storage';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  stage: string | null;
}

interface Conversation {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  created_at: string;
  updated_at: string;
  participant_1?: Profile;
  participant_2?: Profile;
  last_message?: Message;
  unread_count?: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  read: boolean;
  created_at: string;
  sender?: Profile;
  media_type?: string;
  media_url?: string;
}

export default function Messages() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [deleteConversationDialogOpen, setDeleteConversationDialogOpen] = useState(false);
  const [blockUserDialogOpen, setBlockUserDialogOpen] = useState(false);
  const messageChannelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) {
      router.push('/sign-in');
      return;
    }

    loadConversations();
    setupConversationsRealtimeSubscription();
  }, [user, router]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          participant_1:profiles!conversations_participant_1_id_fkey(id, full_name, avatar_url, stage),
          participant_2:profiles!conversations_participant_2_id_fkey(id, full_name, avatar_url, stage)
        `)
        .or(`participant_1_id.eq.${user!.id},participant_2_id.eq.${user!.id}`)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const conversationsWithUnread = await Promise.all(
        (data || []).map(async (conv) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('read', false)
            .neq('sender_id', user!.id);

          const { data: lastMsg } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            unread_count: count || 0,
            last_message: lastMsg,
          };
        })
      );

      setConversations(conversationsWithUnread);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupConversationsRealtimeSubscription = () => {
    const conversationsChannel = supabase
      .channel('conversations-list-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
    };
  };

  const setupMessagesRealtimeSubscription = (conversationId: string) => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
    }

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          if (newMessage.sender_id !== user!.id) {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, stage')
              .eq('id', newMessage.sender_id)
              .maybeSingle();

            const messageWithSender = {
              ...newMessage,
              sender: senderProfile || undefined,
            };

            setMessages((prev) => {
              const exists = prev.some(msg => msg.id === newMessage.id);
              if (exists) return prev;
              return [...prev, messageWithSender];
            });

            setTimeout(() => scrollToBottom(), 100);

            await supabase
              .from('messages')
              .update({ read: true })
              .eq('id', newMessage.id)
              .eq('conversation_id', conversationId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deletedMessageId = payload.old.id;
          setMessages((prev) => prev.filter(msg => msg.id !== deletedMessageId));
        }
      )
      .subscribe();

    messageChannelRef.current = channel;
  };

  const loadMessages = async (conversationId: string) => {
    try {
      console.log('Loading messages for conversation:', conversationId);
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!messages_sender_id_fkey(id, full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error querying messages:', error);
        throw error;
      }

      console.log('Loaded messages:', data?.length || 0, data);
      setMessages(data || []);

      await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user!.id);

      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to load messages',
        variant: 'destructive',
      });
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || !selectedConversation || sending) return;

    const trimmedContent = content.trim();

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_id: user!.id,
      content: trimmedContent,
      media_type: 'text',
      read: false,
      created_at: new Date().toISOString(),
      sender: profile ? {
        id: user!.id,
        full_name: profile.fullName,
        avatar_url: profile.profilePhotoUrl || null,
        stage: profile.businessStage || null,
      } : undefined,
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(), 0);

    try {
      setSending(true);
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user!.id,
          content: trimmedContent,
          media_type: 'text',
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(msg => msg.id === optimisticMessage.id ? { ...data, sender: optimisticMessage.sender } : msg)
      );

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      const otherUser = getOtherParticipant(selectedConversation);
      if (otherUser && profile) {
        await createNotification({
          userId: otherUser.id,
          actorId: user!.id,
          type: 'message',
          content: `${profile.fullName}: ${trimmedContent}`,
          entityType: 'message',
          entityId: selectedConversation.id,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove optimistic message on error
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

  const sendMediaMessage = async (mediaUrl: string, mediaType: 'image' | 'video' | 'audio') => {
    if (!selectedConversation || sending) return;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: selectedConversation.id,
      sender_id: user!.id,
      content: null as any,
      media_url: mediaUrl,
      media_type: mediaType,
      read: false,
      created_at: new Date().toISOString(),
      sender: profile ? {
        id: user!.id,
        full_name: profile.fullName,
        avatar_url: profile.profilePhotoUrl || null,
        stage: profile.businessStage || null,
      } : undefined,
    };

    // Add optimistic message immediately
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollToBottom(), 0);

    try {
      setSending(true);
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_id: user!.id,
          content: null,
          media_url: mediaUrl,
          media_type: mediaType,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(msg => msg.id === optimisticMessage.id ? { ...data, sender: optimisticMessage.sender } : msg)
      );

      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      const otherUser = getOtherParticipant(selectedConversation);
      if (otherUser && profile) {
        const mediaTypeLabel =
          mediaType === 'image' ? '📷 Image' : mediaType === 'video' ? '🎥 Video' : '🎵 Audio';
        await createNotification({
          userId: otherUser.id,
          actorId: user!.id,
          type: 'message',
          content: `${profile.fullName} sent ${mediaTypeLabel}`,
          entityType: 'message',
          entityId: selectedConversation.id,
        });
      }
    } catch (error) {
      console.error('Error sending media message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
      toast({
        title: 'Error',
        description: 'Failed to send media',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageToDelete);

      if (error) throw error;

      toast({
        title: 'Message deleted',
        description: 'The message has been removed',
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete message',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', selectedConversation.id);

      await supabase
        .from('conversations')
        .delete()
        .eq('id', selectedConversation.id);

      setSelectedConversation(null);
      setShowMobileChat(false);
      loadConversations();
      toast({
        title: 'Conversation deleted',
        description: 'The conversation has been removed',
      });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    } finally {
      setDeleteConversationDialogOpen(false);
    }
  };

  const handleBlockUser = async () => {
    if (!selectedConversation) return;

    const otherUser = getOtherParticipant(selectedConversation);
    if (!otherUser) return;

    try {
      await supabase
        .from('blocked_users')
        .insert({
          blocker_id: user!.id,
          blocked_id: otherUser.id,
        });

      toast({
        title: 'User blocked',
        description: `${otherUser.full_name} has been blocked`,
      });

      setSelectedConversation(null);
      setShowMobileChat(false);
      loadConversations();
    } catch (error) {
      console.error('Error blocking user:', error);
      toast({
        title: 'Error',
        description: 'Failed to block user',
        variant: 'destructive',
      });
    } finally {
      setBlockUserDialogOpen(false);
    }
  };


  const getOtherParticipant = (conversation: Conversation): Profile | null => {
    if (!conversation.participant_1 || !conversation.participant_2) return null;
    return conversation.participant_1_id === user!.id
      ? conversation.participant_2
      : conversation.participant_1;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatLastMessagePreview = (message: Message) => {
    if (message.media_type === 'image') return '📷 Image';
    if (message.media_type === 'video') return '🎥 Video';
    if (message.media_type === 'audio') return '🎵 Audio';
    return message.content;
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
    loadMessages(conversation.id);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      setupMessagesRealtimeSubscription(selectedConversation.id);
    }

    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [selectedConversation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedConversation) {
          handleBackToList();
        } else {
          router.push('/feed');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedConversation, router]);

  if (!user || !profile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gray-950">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <>
      {/* Full screen container - no scrolling */}
      <div className="fixed inset-0 bg-gray-950 flex flex-col lg:pt-0">
        {/* Mobile: Single panel (list OR chat) */}
        {/* Desktop: Split panel (list AND chat) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation List - Always visible on desktop, conditionally on mobile */}
          <div className={`
            ${showMobileChat ? 'hidden' : 'flex'}
            lg:flex
            w-full lg:w-[30%]
            flex-col
            border-r border-gray-800
            bg-gray-900
          `}>
            {/* List Header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push('/feed')}
                    className="text-gray-400 hover:text-gray-100 min-w-[44px] min-h-[44px]"
                    aria-label="Back to feed"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <h1 className="text-xl font-bold text-white">Messages</h1>
                </div>
              </div>
            </div>

            {/* Conversations List */}
            <ScrollArea className="flex-1">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 p-3 animate-pulse">
                      <div className="h-12 w-12 bg-gray-700 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-700 rounded w-3/4" />
                        <div className="h-3 bg-gray-700 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <div className="text-5xl mb-4">💬</div>
                  <h3 className="font-semibold text-gray-100 mb-2">No conversations yet</h3>
                  <p className="text-sm text-gray-400">
                    Start a conversation from the Network page
                  </p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {conversations.map((conversation) => {
                    const otherUser = getOtherParticipant(conversation);
                    if (!otherUser) return null;

                    return (
                      <button
                        key={conversation.id}
                        onClick={() => handleSelectConversation(conversation)}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg transition-colors text-left
                          ${selectedConversation?.id === conversation.id
                            ? 'bg-gray-800 border border-gray-700'
                            : 'hover:bg-gray-800/50'
                          }`}
                      >
                        <StorageAvatar
                          src={otherUser.avatar_url}
                          fallback={otherUser.full_name.substring(0, 2).toUpperCase()}
                          className="h-12 w-12 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-white truncate">
                              {otherUser.full_name}
                            </h3>
                            {conversation.unread_count! > 0 && (
                              <Badge className="ml-2 bg-amber-500 text-xs">
                                {conversation.unread_count}
                              </Badge>
                            )}
                          </div>
                          {conversation.last_message && (
                            <p className="text-sm text-gray-400 truncate">
                              {formatLastMessagePreview(conversation.last_message)}
                            </p>
                          )}
                          {conversation.updated_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDistanceToNow(new Date(conversation.updated_at), { addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Chat Area - Always visible on desktop, conditionally on mobile */}
          <div className={`
            ${showMobileChat ? 'flex' : 'hidden'}
            lg:flex
            flex-1
            flex-col
            bg-gray-950
          `}>
            {!selectedConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">Select a conversation</h3>
                  <p className="text-gray-400">Choose a conversation from the list to start messaging</p>
                </div>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleBackToList}
                      className="text-gray-400 hover:text-gray-100 min-w-[44px] min-h-[44px]"
                      aria-label="Back to conversation list"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <StorageAvatar
                      src={getOtherParticipant(selectedConversation)?.avatar_url}
                      fallback={getOtherParticipant(selectedConversation)?.full_name.substring(0, 2).toUpperCase() || 'U'}
                      className="h-10 w-10"
                    />
                    <div>
                      <h2 className="font-semibold text-white">
                        {getOtherParticipant(selectedConversation)?.full_name}
                      </h2>
                      <p className="text-xs text-gray-400">
                        {getOtherParticipant(selectedConversation)?.stage || 'User'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                        <DropdownMenuItem
                          onClick={() => setDeleteConversationDialogOpen(true)}
                          className="text-red-500"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Conversation
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setBlockUserDialogOpen(true)}
                          className="text-red-500"
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Block User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4 py-4" ref={scrollAreaRef}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-4xl mb-2">👋</div>
                      <p className="text-gray-400">Start the conversation</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const isOwn = message.sender_id === user.id;
                        console.log('Rendering message:', message.id, 'type:', message.media_type, 'content:', message.content?.substring(0, 50));
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
                              <div
                                className={`rounded-2xl overflow-hidden ${
                                  isOwn
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-gray-800 text-gray-100'
                                }`}
                              >
                                {message.media_type === 'image' && message.media_url && (
                                  <div className="max-w-xs">
                                    <StorageImage
                                      src={message.media_url}
                                      alt="Shared image"
                                      width={400}
                                      height={400}
                                      className="w-full h-auto rounded-lg"
                                      clickable={true}
                                    />
                                    <p className={`text-xs px-4 pb-2 pt-2 ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                )}
                                {message.media_type === 'video' && message.media_url && (
                                  <div className="max-w-xs">
                                    <StorageVideo
                                      src={message.media_url}
                                      controls
                                      className="w-full h-auto rounded-lg"
                                    />
                                    <p className={`text-xs px-4 pb-2 pt-2 ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                )}
                                {message.media_type === 'audio' && message.media_url && (
                                  <div className="p-2">
                                    <AudioPlayer
                                      src={message.media_url}
                                      compact
                                    />
                                    <p className={`text-xs mt-2 px-2 ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                )}
                                {(message.media_type === 'text' || !message.media_type) && message.content && (
                                  <div className="px-4 py-2">
                                    <LinkifyText text={message.content} />
                                    <p className={`text-xs mt-1 ${isOwn ? 'text-amber-200' : 'text-gray-500'}`}>
                                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Message Input */}
                <MediaMessageComposer
                  onSendText={sendMessage}
                  onSendMedia={sendMediaMessage}
                  disabled={sending}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Delete this message?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMessage} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConversationDialogOpen} onOpenChange={setDeleteConversationDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              All messages will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConversation} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockUserDialogOpen} onOpenChange={setBlockUserDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Block this user?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              They will no longer be able to send you messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className="bg-red-600 hover:bg-red-700">
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
