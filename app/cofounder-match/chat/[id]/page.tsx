'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { ArrowLeft, Send, Image as ImageIcon, Play, Loader2, Home, Trash2, Mic, Link as LinkIcon, User, Users, Briefcase, MapPin, Clock, TrendingUp, Star } from 'lucide-react';
import { StorageImage } from '@/components/storage-image';
import { StorageVideo } from '@/components/storage-video';
import { StorageAvatar } from '@/components/storage-avatar';
import { AudioPlayer } from '@/components/audio-player';
import { LinkifyText } from '@/components/linkify-text';
import { AudioRecorder } from '@/components/audio-recorder';
import { notificationHelpers } from '@/lib/notifications';

interface Message {
  id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  media_type: 'text' | 'image' | 'video' | 'audio';
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface MatchedUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
}

export default function CofounderChatPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [matchedUser, setMatchedUser] = useState<MatchedUser | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<MatchedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<any>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadChat();
      subscribeToMessages();
    }
  }, [user, params.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChat = async () => {
    if (!user?.id) {
      console.error('No user ID found');
      setLoading(false);
      return;
    }

    console.log('Loading match with ID:', params.id);
    console.log('Current user ID:', user.id);

    const { data: match, error } = await supabase
      .from('cofounder_matches')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading match:', error);
      setLoading(false);
      return;
    }

    console.log('Match data:', match);

    if (!match) {
      console.error('No match found with ID:', params.id);
      setLoading(false);
      return;
    }

    // Verify user is part of this match
    if (match.user_id !== user.id && match.matched_user_id !== user.id) {
      console.error('User is not part of this match');
      setLoading(false);
      return;
    }

    // Get the other user's profile
    const otherUserId = match.user_id === user.id ? match.matched_user_id : match.user_id;

    console.log('Loading profile for other user:', otherUserId);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio')
      .eq('id', otherUserId)
      .maybeSingle();

    if (profileError) {
      console.error('Error loading profile:', profileError);
    }

    console.log('Loaded profile:', profile);

    if (profile) {
      setMatchedUser(profile);
      loadMessages();
    }

    // Load current user's profile
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio')
      .eq('id', user.id)
      .maybeSingle();

    if (myProfile) {
      setCurrentUserProfile(myProfile);
    }

    setLoading(false);
  };

  const loadMessages = async () => {
    const { data: messagesData, error } = await supabase
      .from('cofounder_messages')
      .select('*')
      .eq('match_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }

    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      return;
    }

    // Get unique sender IDs
    const senderIds = Array.from(new Set(messagesData.map(m => m.sender_id)));

    // Fetch sender profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', senderIds);

    if (profilesError) {
      console.error('Error loading profiles:', profilesError);
      setMessages(messagesData);
      return;
    }

    // Map profiles to messages
    const profileMap = new Map(profiles?.map(p => [p.id, p]));
    const messagesWithSenders = messagesData.map(msg => ({
      ...msg,
      sender: profileMap.get(msg.sender_id)
    }));

    setMessages(messagesWithSenders);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`cofounder_messages:${params.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cofounder_messages',
          filter: `match_id=eq.${params.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadMessages();
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };


  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('user-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('user-media')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete) return;

    // Optimistically update UI
    setMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));

    const { error } = await supabase
      .from('cofounder_messages')
      .delete()
      .eq('id', messageToDelete);

    if (error) {
      console.error('Error deleting message:', error);
      // Reload messages on error to restore the UI
      loadMessages();
    }

    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !mediaFile) || sending || !user || !currentUserProfile) return;

    const messageContent = newMessage.trim();
    const tempMessageId = `temp-${Date.now()}`;
    const currentMediaFile = mediaFile;
    const currentMediaType = mediaType;

    // Create temporary URL for media if present
    let tempMediaUrl: string | null = null;
    if (currentMediaFile) {
      tempMediaUrl = URL.createObjectURL(currentMediaFile);
    }

    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      id: tempMessageId,
      sender_id: user.id,
      content: messageContent || null,
      media_url: tempMediaUrl,
      media_type: currentMediaType,
      created_at: new Date().toISOString(),
      sender: {
        full_name: currentUserProfile.full_name,
        avatar_url: currentUserProfile.avatar_url
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Clear input immediately
    setNewMessage('');
    setMediaFile(null);
    setMediaType('text');
    setSending(true);

    try {
      // Upload media if present
      let mediaUrl: string | null = null;
      if (currentMediaFile) {
        setUploadingMedia(true);
        mediaUrl = await uploadFile(currentMediaFile);
        setUploadingMedia(false);

        if (!mediaUrl) {
          // Remove optimistic message on upload error
          setMessages(prev => prev.filter(m => m.id !== tempMessageId));
          setSending(false);
          return;
        }
      }

      // Insert into database
      const { data, error } = await supabase
        .from('cofounder_messages')
        .insert({
          match_id: params.id,
          sender_id: user.id,
          content: messageContent || null,
          media_url: mediaUrl,
          media_type: currentMediaType
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        setSending(false);
        return;
      }

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(m => m.id === tempMessageId ? {
          ...data,
          sender: optimisticMessage.sender
        } : m)
      );

      // Send notification to the matched user
      if (matchedUser && currentUserProfile) {
        await notificationHelpers.cofounderMessage(
          user.id,
          matchedUser.id,
          currentUserProfile.full_name
        );
      }

      // Clean up temporary URL if used
      if (tempMediaUrl) {
        URL.revokeObjectURL(tempMediaUrl);
      }

      setSending(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      setSending(false);
      setUploadingMedia(false);
    }
  };

  const copyMatchLink = async () => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'cofounder',
      id: params.id,
    });

    if (success) {
      alert('Link copied to clipboard!');
    } else {
      alert('Failed to copy link');
    }
  };

  const loadCofounderProfile = async () => {
    if (!matchedUser) return;

    const { data, error } = await supabase
      .from('cofounder_profiles')
      .select(`
        *,
        user:profiles!cofounder_profiles_user_id_fkey (
          full_name,
          avatar_url,
          bio
        )
      `)
      .eq('user_id', matchedUser.id)
      .single();

    if (!error && data) {
      setViewingProfile(data);
      setProfileDialogOpen(true);
    }
  };


  const handleAudioRecordingComplete = async (audioBlob: Blob) => {
    setIsRecordingAudio(false);

    if (!user || !currentUserProfile) return;

    // Create a temporary local URL for immediate preview
    const tempAudioUrl = URL.createObjectURL(audioBlob);
    const tempMessageId = `temp-${Date.now()}`;

    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      id: tempMessageId,
      sender_id: user.id,
      content: null,
      media_url: tempAudioUrl,
      media_type: 'audio',
      created_at: new Date().toISOString(),
      sender: {
        full_name: currentUserProfile.full_name,
        avatar_url: currentUserProfile.avatar_url
      }
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Convert blob to file and upload in background
    const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });

    try {
      setUploadingMedia(true);
      const mediaUrl = await uploadFile(audioFile);
      setUploadingMedia(false);

      if (!mediaUrl) {
        // Remove optimistic message on error
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        return;
      }

      // Insert into database
      const { data, error } = await supabase
        .from('cofounder_messages')
        .insert({
          match_id: params.id,
          sender_id: user.id,
          content: null,
          media_url: mediaUrl,
          media_type: 'audio'
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving message:', error);
        setMessages(prev => prev.filter(m => m.id !== tempMessageId));
        return;
      }

      // Replace optimistic message with real one
      setMessages(prev =>
        prev.map(m => m.id === tempMessageId ? {
          ...data,
          sender: optimisticMessage.sender
        } : m)
      );

      // Clean up temporary URL
      URL.revokeObjectURL(tempAudioUrl);
    } catch (error) {
      console.error('Error uploading audio:', error);
      setMessages(prev => prev.filter(m => m.id !== tempMessageId));
      setUploadingMedia(false);
    }
  };

  const handleCancelAudioRecording = () => {
    setIsRecordingAudio(false);
  };

  if (!user) {
    router.replace('/sign-in');
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!matchedUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-8 text-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-100">Match not found</h3>
            <Button onClick={() => router.replace('/cofounder-match')} className="bg-amber-500 hover:bg-amber-600 text-gray-900">
              Back to Matches
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <>
      <div className="h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex flex-col">
      <div className="flex-shrink-0 max-w-4xl w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/cofounder-match')}
            className="text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Matches
          </Button>
        </div>
      </div>

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 pb-4 flex flex-col min-h-0">
        <Card className="flex-1 flex flex-col bg-gray-900 border-gray-800 min-h-0">
          {/* Chat Header */}
          <div className="border-b border-gray-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => router.back()}
                  className="text-gray-400 hover:text-gray-100 flex-shrink-0"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <StorageAvatar
                  src={matchedUser.avatar_url}
                  fallback={matchedUser.full_name.split(' ').map(n => n[0]).join('')}
                  className="h-12 w-12 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-100 capitalize truncate">{matchedUser.full_name}</h2>
                  {matchedUser.bio && (
                    <p className="text-sm text-gray-400 truncate">{matchedUser.bio}</p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadCofounderProfile}
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 flex-shrink-0"
              >
                <User className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">View Profile</span>
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-4 p-4 md:p-6">
              {messages.map((message) => {
                const isOwn = message.sender_id === user.id;
                return (
                  <div
                    key={message.id}
                    className={`flex group ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] sm:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      <StorageAvatar
                        src={message.sender?.avatar_url}
                        alt={message.sender?.full_name}
                        fallback={message.sender?.full_name.split(' ').map(n => n[0]).join('')}
                        className="h-8 w-8 flex-shrink-0 border-2 border-amber-500"
                      />
                      <div className="relative flex-1 min-w-0">
                        {message.media_type === 'image' && message.media_url && (
                          <div className="rounded-lg overflow-hidden max-w-xs max-h-[300px] mb-2">
                            <StorageImage
                              src={message.media_url}
                              alt="Shared image"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {message.media_type === 'video' && message.media_url && (
                          <div className="rounded-lg overflow-hidden max-w-xs max-h-[300px] mb-2">
                            <StorageVideo
                              src={message.media_url}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        {message.media_type === 'audio' && message.media_url && (
                          <div className={`rounded-lg p-2.5 sm:p-3 min-w-[260px] max-w-[320px] ${
                            isOwn
                              ? 'bg-gradient-to-br from-amber-500 to-yellow-500'
                              : 'bg-gray-800'
                          }`}>
                            <AudioPlayer
                              src={message.media_url}
                              compact
                            />
                          </div>
                        )}
                        {message.content && (
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              isOwn
                                ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-gray-900'
                                : 'bg-gray-800 text-gray-100'
                            }`}
                          >
                            <LinkifyText text={message.content} className="text-sm leading-relaxed break-words whitespace-pre-wrap" />
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-gray-500">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {isOwn && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setMessageToDelete(message.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 border-t border-gray-800 p-3 sm:p-4 space-y-3 bg-gray-900/50">
            {mediaFile && (
              <div className="relative inline-block">
                {mediaType === 'image' && (
                  <div className="relative w-32 h-24">
                    <Image
                      src={URL.createObjectURL(mediaFile)}
                      alt="Preview"
                      fill
                      className="rounded-lg object-cover border-2 border-gray-700"
                    />
                  </div>
                )}
                {mediaType === 'video' && (
                  <video
                    src={URL.createObjectURL(mediaFile)}
                    className="rounded-lg max-h-24 border-2 border-gray-700"
                  />
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 p-0"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaType('text');
                  }}
                >
                  ×
                </Button>
              </div>
            )}

            {/* Audio Recorder */}
            {isRecordingAudio ? (
              <AudioRecorder
                onRecordingComplete={handleAudioRecordingComplete}
                onCancel={handleCancelAudioRecording}
              />
            ) : (
              <>
                {/* Instagram-Style Input Area */}
                <div className="flex items-end gap-2">
                  {/* Main Input */}
                  <div className="flex-1 flex items-center gap-2 bg-gray-800 border-2 border-gray-700 rounded-3xl px-4 py-2.5">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type..."
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      className="flex-1 bg-transparent border-0 text-gray-100 placeholder:text-gray-500 text-base px-0 h-auto py-1 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />

                {/* Media Buttons - Hidden when typing (Instagram style) */}
                {!newMessage.trim() && (
                  <div className="flex items-center gap-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setMediaFile(file);
                          setMediaType('image');
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-gray-800"
                    >
                      <ImageIcon className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </Button>

                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setMediaFile(file);
                          setMediaType('video');
                        }
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => videoInputRef.current?.click()}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-gray-800"
                    >
                      <Play className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsRecordingAudio(true)}
                      className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl hover:bg-amber-500/20 hover:text-amber-400 transition-all"
                      title="Record voice message"
                    >
                      <Mic className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400 hover:text-amber-400" />
                    </Button>
                  </div>
                )}
              </div>

                  {/* Copy Link Button */}
                  <Button
                    onClick={copyMatchLink}
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex-shrink-0 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                  >
                    <LinkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                  </Button>

                  {/* Send Button */}
                  <Button
                    onClick={sendMessage}
                    disabled={(!newMessage.trim() && !mediaFile) || sending || uploadingMedia}
                    className="bg-gradient-to-br from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 h-10 w-10 sm:h-12 sm:w-12 rounded-2xl shadow-lg hover:shadow-amber-500/50 transition-all flex-shrink-0"
                  >
                    {uploadingMedia ? (
                      <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Delete this message?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. The message will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMessage}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <StorageAvatar
                src={viewingProfile?.user?.avatar_url}
                fallback={viewingProfile?.user?.full_name?.split(' ').map((n: string) => n[0]).join('')}
                className="h-16 w-16"
              />
              <div>
                <DialogTitle className="text-2xl capitalize text-gray-100">{viewingProfile?.user?.full_name}</DialogTitle>
                {viewingProfile?.user?.bio && (
                  <DialogDescription className="text-base mt-1 text-gray-400">{viewingProfile.user.bio}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>

          {viewingProfile && (
            <div className="space-y-6 mt-4">
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  <Briefcase className="h-4 w-4 mr-1" />
                  {viewingProfile.industry}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {viewingProfile.stage}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <MapPin className="h-4 w-4 mr-1" />
                  {viewingProfile.location}
                  {viewingProfile.remote_ok && ' (Remote OK)'}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <Clock className="h-4 w-4 mr-1" />
                  {viewingProfile.commitment}
                </Badge>
              </div>

              <div>
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-2 text-amber-500" />
                  Startup Idea
                </h4>
                <p className="text-gray-300 bg-gray-800 rounded-lg p-4">{viewingProfile.startup_idea}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-100 mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-amber-500" />
                  Looking For
                </h4>
                <div className="flex flex-wrap gap-2">
                  {viewingProfile.role_seeking?.map((role: string) => (
                    <Badge key={role} variant="secondary" className="text-sm">{role}</Badge>
                  ))}
                </div>
              </div>

              {viewingProfile.skills && viewingProfile.skills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-100 mb-3">Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.skills.map((s: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {s.skill} - {s.level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingProfile.interests && viewingProfile.interests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-100 mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.interests.map((interest: any, i: number) => (
                      <Badge key={i} className="text-sm bg-gradient-to-r from-amber-500 to-yellow-500">
                        {interest.interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(viewingProfile.demo_video_url || (viewingProfile.pitch_images && viewingProfile.pitch_images.length > 0)) && (
                <div className="border-t border-gray-700 pt-6 space-y-4">
                  <h4 className="font-semibold text-gray-100 mb-3 flex items-center">
                    <Play className="h-4 w-4 mr-2 text-amber-500" />
                    Pitch Materials
                  </h4>

                  {viewingProfile.demo_video_url && (
                    <div>
                      <Label className="text-gray-300 mb-2 block">Demo Video</Label>
                      <StorageVideo src={viewingProfile.demo_video_url} className="w-full rounded-lg" />
                    </div>
                  )}

                  {viewingProfile.pitch_images && viewingProfile.pitch_images.length > 0 && (
                    <div>
                      <Label className="text-gray-300 mb-2 block">Pitch Images</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {viewingProfile.pitch_images.map((url: string, i: number) => (
                          <StorageImage
                            key={i}
                            src={url}
                            alt={`Pitch ${i + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <h4 className="font-semibold text-gray-100 mb-2">Equity Split</h4>
                  <p className="text-gray-300">{viewingProfile.equity_split}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-100 mb-2">Status</h4>
                  <p className="text-gray-300">
                    {viewingProfile.looking_for_cofounder ? (
                      <span className="text-green-400">● Actively Looking</span>
                    ) : (
                      <span className="text-gray-400">● Not Looking</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}