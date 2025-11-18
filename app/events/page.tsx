'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StorageAvatar } from '@/components/storage-avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar, Clock, MapPin, Users, Video, Home, Radio, Plus, Settings, Bell, Play, Send, Shield, UserPlus, Trash2, StopCircle, ArrowLeft, Image as ImageIcon, Film, Music, Paperclip, X, Mic, Link as LinkIcon } from 'lucide-react';
import { VideoCallRoom } from '@/components/video-call-room';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { uploadToUserMedia } from '@/lib/storage';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import { notificationHelpers } from '@/lib/notifications';

interface Admin {
  id: string;
  user_id: string;
  is_super_admin: boolean;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Event {
  id: string;
  room_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_url: string | null;
  max_attendees: number | null;
  cover_image_url: string | null;
  created_by: string;
  is_live: boolean;
  live_started_at: string | null;
  live_started_by: string | null;
  attendee_count?: number;
  is_registered?: boolean;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  sender?: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function EventsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { toast } = useToast();
  const [events, setEvents] = useState<Event[]>([]);
  const [liveEvents, setLiveEvents] = useState<Event[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [manageAdminsOpen, setManageAdminsOpen] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [inLiveCall, setInLiveCall] = useState(false);
  const [currentLiveEvent, setCurrentLiveEvent] = useState<Event | null>(null);
  const [liveParticipants, setLiveParticipants] = useState<Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>>([]);

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    event_type: 'virtual',
    start_time: '',
    end_time: '',
    location: '',
    meeting_url: '',
    max_attendees: ''
  });

  useEffect(() => {
    if (user) {
      loadData();
      subscribeToUpdates();
    }
  }, [user]);

  const subscribeToUpdates = () => {
    const eventsChannel = supabase
      .channel('events-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        loadEvents();
      })
      .subscribe();

    const chatChannel = supabase
      .channel('admin-chat')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_chat_messages'
      }, () => {
        loadAdminChat();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(chatChannel);
    };
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      checkAdminStatus(),
      loadEvents(),
      loadAdmins()
    ]);
    setLoading(false);
  };

  const checkAdminStatus = async () => {
    const { data } = await supabase
      .from('event_admins')
      .select('is_super_admin')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (data) {
      setIsAdmin(true);
      setIsSuperAdmin(data.is_super_admin);
      if (data) {
        loadAdminChat();
      }
    }
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (data) {
      const eventsWithCounts = await Promise.all(
        data.map(async (event) => {
          const { count } = await supabase
            .from('event_attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('status', 'registered');

          const { data: registration } = await supabase
            .from('event_attendees')
            .select('id')
            .eq('event_id', event.id)
            .eq('user_id', user!.id)
            .eq('status', 'registered')
            .maybeSingle();

          return {
            ...event,
            attendee_count: count || 0,
            is_registered: !!registration
          };
        })
      );

      setEvents(eventsWithCounts);
      setLiveEvents(eventsWithCounts.filter(e => e.is_live));
      setUpcomingEvents(eventsWithCounts.filter(e => !e.is_live));
    }
  };

  const loadAdmins = async () => {
    const { data } = await supabase
      .from('event_admins')
      .select(`
        *,
        user:profiles!event_admins_user_id_fkey(full_name, avatar_url)
      `)
      .order('is_super_admin', { ascending: false })
      .order('created_at', { ascending: true });

    if (data) {
      setAdmins(data);
    }
  };

  const loadAdminChat = async () => {
    const { data } = await supabase
      .from('admin_chat_messages')
      .select(`
        *,
        sender:profiles!admin_chat_messages_sender_id_fkey(full_name, avatar_url)
      `)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setChatMessages(data);
    }
  };

  const createEvent = async () => {
    if (!eventForm.title || !eventForm.start_time || !eventForm.end_time) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive'
      });
      return;
    }

    // Validate start time is before end time
    if (new Date(eventForm.start_time) >= new Date(eventForm.end_time)) {
      toast({
        title: 'Error',
        description: 'End time must be after start time',
        variant: 'destructive'
      });
      return;
    }

    let { data: userRoom, error: roomError } = await supabase
      .from('user_rooms')
      .select('id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (roomError) {
      toast({
        title: 'Error',
        description: 'Unable to access rooms. Please try again.',
        variant: 'destructive'
      });
      return;
    }

    if (!userRoom) {
      const roomName = profile?.fullName ? `${profile.fullName}'s Room` : 'My Event Room';
      const { data: newRoom, error: createRoomError } = await supabase
        .from('user_rooms')
        .insert({
          user_id: user!.id,
          name: roomName,
          description: 'Welcome to my event space!'
        })
        .select('id')
        .single();

      if (createRoomError || !newRoom) {
        toast({
          title: 'Error',
          description: 'Unable to create your room. Please try again.',
          variant: 'destructive'
        });
        return;
      }

      userRoom = newRoom;
    }

    // Insert event and get it back
    const { data: newEvent, error } = await supabase
      .from('events')
      .insert({
        room_id: userRoom.id,
        title: eventForm.title,
        description: eventForm.description,
        event_type: eventForm.event_type,
        start_time: eventForm.start_time,
        end_time: eventForm.end_time,
        location: eventForm.location || null,
        meeting_url: eventForm.meeting_url || null,
        max_attendees: eventForm.max_attendees ? parseInt(eventForm.max_attendees) : null,
        created_by: user!.id,
        attendee_count: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Event creation error:', error);
      toast({
        title: 'Error',
        description: `Failed to create event: ${error.message}`,
        variant: 'destructive'
      });
      return;
    }

    if (!newEvent) {
      toast({
        title: 'Error',
        description: 'Event creation failed. Please try again.',
        variant: 'destructive'
      });
      return;
    }

    // Optimistic update - add new event to the list immediately
    const optimisticEvent: Event = {
      ...newEvent,
      attendee_count: 0,
      is_registered: false
    };

    setEvents(prevEvents => [optimisticEvent, ...prevEvents]);

    // Categorize the new event
    const eventDate = new Date(optimisticEvent.start_time);
    const now = new Date();

    if (optimisticEvent.is_live) {
      setLiveEvents(prev => [optimisticEvent, ...prev]);
    } else if (eventDate > now) {
      setUpcomingEvents(prev => [optimisticEvent, ...prev]);
    }

    toast({
      title: 'Success',
      description: 'Event created successfully! It is now visible to all users.'
    });

    // Reset form and close dialog
    setEventForm({
      title: '',
      description: '',
      event_type: 'virtual',
      start_time: '',
      end_time: '',
      location: '',
      meeting_url: '',
      max_attendees: ''
    });
    setCreateEventOpen(false);

    // Realtime will sync with other users automatically
  };

  const startLive = async (eventId: string) => {
    const { error } = await supabase.rpc('start_live_event', { event_id: eventId });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Live Started',
      description: 'Event is now live!'
    });

    // Realtime will handle updating the UI

    const liveEvent = events.find(e => e.id === eventId);
    if (liveEvent) {
      await joinLive({ ...liveEvent, is_live: true });
    }
  };

  const endLive = async (eventId: string) => {
    const { error } = await supabase.rpc('end_live_event', { event_id: eventId });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Live Ended',
      description: 'Event is no longer live'
    });

    // Realtime will handle updating the UI
  };

  const joinLive = async (event: Event) => {
    setCurrentLiveEvent(event);

    const { data: attendees } = await supabase
      .from('event_attendees')
      .select(`
        user_id,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('event_id', event.id);

    const participants = attendees?.map((a: any) => ({
      id: a.user_id,
      full_name: a.profiles?.full_name || 'Unknown',
      avatar_url: a.profiles?.avatar_url || null
    })) || [];

    if (!participants.find(p => p.id === user!.id)) {
      participants.push({
        id: user!.id,
        full_name: profile?.fullName || 'You',
        avatar_url: profile?.profilePhotoUrl || null
      });
    }

    setLiveParticipants(participants);
    setInLiveCall(true);
  };

  const leaveLive = () => {
    setInLiveCall(false);
    setCurrentLiveEvent(null);
    setLiveParticipants([]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadMedia = async (file: File) => {
    let fileToUpload = file;

    // Apply maximum compression for images only
    if (file.type.startsWith('image/')) {
      const settings = getCompressionSettings(file.size);
      fileToUpload = await compressImage(file, settings);
      console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB -> ${(fileToUpload.size / 1024).toFixed(0)}KB`);
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.name}`;
    const result = await uploadToUserMedia(fileToUpload, user!.id, 'admin-chat', fileName, {
      compress: false, // Already compressed for images
    });
    return result.url;
  };

  const getMediaType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'file';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });

        stream.getTracks().forEach(track => track.stop());

        setUploadingMedia(true);
        try {
          const mediaUrl = await uploadMedia(audioFile);

          const { error } = await supabase
            .from('admin_chat_messages')
            .insert({
              sender_id: user!.id,
              message: null,
              media_url: mediaUrl,
              media_type: 'audio'
            });

          if (error) throw error;

          loadAdminChat();
        } catch (error: any) {
          toast({
            title: 'Error',
            description: error.message || 'Failed to send audio',
            variant: 'destructive'
          });
        } finally {
          setUploadingMedia(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Could not access microphone',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setMediaRecorder(null);
      setIsRecording(false);
      setRecordingDuration(0);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('admin_chat_messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      loadAdminChat();
      toast({
        title: 'Success',
        description: 'Message deleted successfully'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete message',
        variant: 'destructive'
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;

    setUploadingMedia(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (selectedFile) {
        mediaUrl = await uploadMedia(selectedFile);
        mediaType = getMediaType(selectedFile);
      }

      const { error } = await supabase
        .from('admin_chat_messages')
        .insert({
          sender_id: user!.id,
          message: newMessage.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType
        });

      if (error) {
        throw error;
      }

      setNewMessage('');
      setSelectedFile(null);
      loadAdminChat();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive'
      });
    } finally {
      setUploadingMedia(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;

    const { data: userToAdd } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', newAdminEmail.trim())
      .maybeSingle();

    if (!userToAdd) {
      toast({
        title: 'Error',
        description: 'User not found',
        variant: 'destructive'
      });
      return;
    }

    const { error } = await supabase
      .from('event_admins')
      .insert({
        user_id: userToAdd.id,
        added_by: user!.id
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Admin added successfully'
    });

    setNewAdminEmail('');
    loadAdmins();
  };

  const removeAdmin = async (adminId: string) => {
    const { error } = await supabase
      .from('event_admins')
      .delete()
      .eq('id', adminId);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
      return;
    }

    toast({
      title: 'Success',
      description: 'Admin removed successfully'
    });

    loadAdmins();
  };

  const copyEventLink = async (eventId: string) => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'event',
      id: eventId,
    });

    if (success) {
      toast({
        title: 'Link copied!',
        description: getCopySuccessMessage('event'),
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const registerForEvent = async (eventId: string) => {
    // Find the event to get host info and event name
    const event = [...events, ...liveEvents, ...upcomingEvents].find(e => e.id === eventId);

    const { error } = await supabase.from('event_attendees').insert({
      event_id: eventId,
      user_id: user!.id,
      status: 'registered'
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to register for event',
        variant: 'destructive'
      });
      return;
    }

    // Send notification to event host
    if (event && profile) {
      await notificationHelpers.eventRsvp(
        user!.id,
        event.created_by,
        eventId,
        profile.fullName,
        event.title
      );
    }

    toast({
      title: 'Success',
      description: 'Registered for event'
    });

    // Realtime will handle updating the UI
  };

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href="/feed">
            <Button variant="ghost" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-100 mb-2">Events & Meetups</h1>
              <p className="text-gray-400">Discover and host virtual and in-person events</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                <Button onClick={() => setCreateEventOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Button>
                {isSuperAdmin && (
                  <Button variant="outline" onClick={() => setManageAdminsOpen(true)}>
                    <Shield className="h-4 w-4 mr-2" />
                    Manage Admins
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="discover" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discover">
              <Calendar className="h-4 w-4 mr-2" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="live">
              <Radio className="h-4 w-4 mr-2" />
              Live Now
              {liveEvents.length > 0 && (
                <Badge variant="destructive" className="ml-2">{liveEvents.length}</Badge>
              )}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="my-room">
                <Settings className="h-4 w-4 mr-2" />
                My Room
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="discover" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-4">Upcoming Events</h2>
              {upcomingEvents.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-100 mb-2">No upcoming events</h3>
                    <p className="text-gray-400">Check back later for new events</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingEvents.map((event) => (
                    <Card key={event.id} className="hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <Badge variant={event.event_type === 'virtual' ? 'default' : 'secondary'}>
                            {event.event_type === 'virtual' ? <Video className="h-3 w-3 mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                            {event.event_type}
                          </Badge>
                          {isAdmin && (
                            <Button
                              size="sm"
                              onClick={() => startLive(event.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              <Video className="h-3 w-3 mr-1" />
                              Go Live
                            </Button>
                          )}
                        </div>

                        <h3 className="font-semibold text-lg text-gray-100 mb-2">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-gray-400 mb-4 line-clamp-2">{event.description}</p>
                        )}

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-400">
                            <Clock className="h-4 w-4 mr-2" />
                            {format(new Date(event.start_time), 'MMM dd, yyyy - h:mm a')}
                          </div>
                          {event.location && (
                            <div className="flex items-center text-sm text-gray-400">
                              <MapPin className="h-4 w-4 mr-2" />
                              {event.location}
                            </div>
                          )}
                          <div className="flex items-center text-sm text-gray-400">
                            <Users className="h-4 w-4 mr-2" />
                            {event.attendee_count} attending
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            variant={event.is_registered ? 'outline' : 'default'}
                            onClick={() => registerForEvent(event.id)}
                            disabled={event.is_registered}
                          >
                            {event.is_registered ? 'Registered' : 'Register'}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyEventLink(event.id)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="live" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-100 mb-4">Live Events</h2>
              {liveEvents.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Radio className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-100 mb-2">No live events</h3>
                    <p className="text-gray-400">Check back later for live events</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {liveEvents.map((event) => (
                    <Card key={event.id} className="border-red-500 border-2 hover:shadow-lg transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <Badge variant="destructive" className="animate-pulse">
                            <Radio className="h-3 w-3 mr-1" />
                            LIVE
                          </Badge>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => endLive(event.id)}
                            >
                              <StopCircle className="h-3 w-3 mr-1" />
                              End Live
                            </Button>
                          )}
                        </div>

                        <h3 className="font-semibold text-lg text-gray-100 mb-2">{event.title}</h3>
                        {event.description && (
                          <p className="text-sm text-gray-400 mb-4 line-clamp-2">{event.description}</p>
                        )}

                        <div className="space-y-2 mb-4">
                          <div className="flex items-center text-sm text-gray-400">
                            <Users className="h-4 w-4 mr-2" />
                            {event.attendee_count} watching
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 bg-red-600 hover:bg-red-700"
                            onClick={() => joinLive(event)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Join Live
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyEventLink(event.id)}
                          >
                            <LinkIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="my-room" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-500" />
                    Admin Room
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-2">Admin Team</h3>
                      <div className="space-y-2 mb-4">
                        {admins.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between p-3 bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 rounded-lg">
                            <div className="flex items-center gap-3">
                              <StorageAvatar
                                src={admin.user?.avatar_url}
                                fallback={admin.user?.full_name[0]}
                                className="h-10 w-10"
                              />
                              <div>
                                <p className="font-medium text-gray-100 capitalize">{admin.user?.full_name}</p>
                                {admin.is_super_admin && (
                                  <Badge variant="default" className="mt-1">Super Admin</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-gray-100 mb-2">Admin Chat</h3>
                      <ScrollArea className="h-96 border rounded-lg p-4 mb-4 bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
                        <div className="space-y-4">
                          {chatMessages.map((msg) => (
                            <div key={msg.id} className="flex gap-3 group">
                              <StorageAvatar
                                src={msg.sender?.avatar_url}
                                fallback={msg.sender?.full_name[0]}
                                className="h-8 w-8 flex-shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium text-sm capitalize">{msg.sender?.full_name}</span>
                                  <span className="text-xs text-gray-500">
                                    {format(new Date(msg.created_at), 'h:mm a')}
                                  </span>
                                  {(msg.sender_id === user?.id || isSuperAdmin) && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => deleteMessage(msg.id)}
                                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                                      title="Delete message"
                                    >
                                      <Trash2 className="h-3 w-3 text-red-600" />
                                    </Button>
                                  )}
                                </div>
                                {msg.message && (
                                  <p className="text-sm text-gray-300 mb-2">{msg.message}</p>
                                )}
                                {msg.media_url && msg.media_type === 'image' && (
                                  <div className="relative w-80 h-60">
                                    <Image
                                      src={msg.media_url}
                                      alt="Shared image"
                                      fill
                                      className="rounded-lg object-cover border border-gray-800"
                                    />
                                  </div>
                                )}
                                {msg.media_url && msg.media_type === 'video' && (
                                  <video
                                    src={msg.media_url}
                                    controls
                                    className="max-w-xs rounded-lg border border-gray-800"
                                  />
                                )}
                                {msg.media_url && msg.media_type === 'audio' && (
                                  <audio
                                    src={msg.media_url}
                                    controls
                                    className="w-full max-w-xs"
                                  />
                                )}
                                {msg.media_url && msg.media_type === 'file' && (
                                  <a
                                    href={msg.media_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-amber-500 hover:text-blue-700"
                                  >
                                    <Paperclip className="h-4 w-4" />
                                    Download File
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>

                      {selectedFile && (
                        <div className="mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {selectedFile.type.startsWith('image/') && <ImageIcon className="h-4 w-4 text-amber-500" />}
                            {selectedFile.type.startsWith('video/') && <Film className="h-4 w-4 text-amber-500" />}
                            {selectedFile.type.startsWith('audio/') && <Music className="h-4 w-4 text-amber-500" />}
                            {!selectedFile.type.startsWith('image/') && !selectedFile.type.startsWith('video/') && !selectedFile.type.startsWith('audio/') && <Paperclip className="h-4 w-4 text-amber-500" />}
                            <span className="text-sm text-gray-300">{selectedFile.name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedFile(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {isRecording ? (
                        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="h-3 w-3 bg-red-600 rounded-full animate-pulse" />
                            <span className="text-sm font-medium text-red-600">
                              Recording... {formatRecordingTime(recordingDuration)}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelRecording}
                            className="text-gray-400 hover:text-gray-100"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={stopRecording}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                            disabled={uploadingMedia}
                            className="flex-1"
                          />

                          <input
                            type="file"
                            id="image-upload"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => document.getElementById('image-upload')?.click()}
                            disabled={uploadingMedia}
                            title="Upload Image"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </Button>

                          <input
                            type="file"
                            id="video-upload"
                            className="hidden"
                            accept="video/*"
                            onChange={handleFileSelect}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => document.getElementById('video-upload')?.click()}
                            disabled={uploadingMedia}
                            title="Upload Video"
                          >
                            <Film className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="icon"
                            onClick={startRecording}
                            disabled={uploadingMedia}
                            title="Record Audio"
                            className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                          >
                            <Mic className="h-4 w-4" />
                          </Button>

                          <Button
                            onClick={sendMessage}
                            disabled={uploadingMedia || (!newMessage.trim() && !selectedFile)}
                            size="icon"
                          >
                            {uploadingMedia ? (
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <Dialog open={createEventOpen} onOpenChange={setCreateEventOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Event</DialogTitle>
              <DialogDescription>Create a new event or meetup</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <Input
                  value={eventForm.title}
                  onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Event Type</Label>
                <Select value={eventForm.event_type} onValueChange={(v) => setEventForm({ ...eventForm, event_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="virtual">Virtual</SelectItem>
                    <SelectItem value="in-person">In-Person</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.start_time}
                    onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={eventForm.end_time}
                    onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  />
                </div>
              </div>
              {eventForm.event_type !== 'virtual' && (
                <div>
                  <Label>Location</Label>
                  <Input
                    value={eventForm.location}
                    onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  />
                </div>
              )}
              {eventForm.event_type !== 'in-person' && (
                <div>
                  <Label>Meeting URL</Label>
                  <Input
                    value={eventForm.meeting_url}
                    onChange={(e) => setEventForm({ ...eventForm, meeting_url: e.target.value })}
                  />
                </div>
              )}
              <div>
                <Label>Max Attendees (optional)</Label>
                <Input
                  type="number"
                  value={eventForm.max_attendees}
                  onChange={(e) => setEventForm({ ...eventForm, max_attendees: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateEventOpen(false)}>Cancel</Button>
              <Button onClick={createEvent}>Create Event</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={manageAdminsOpen} onOpenChange={setManageAdminsOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Manage Admins</DialogTitle>
              <DialogDescription>Add or remove admin access</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Add Admin by Email</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="user@example.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                  <Button onClick={addAdmin}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Current Admins</Label>
                <ScrollArea className="h-64 border rounded-lg p-4">
                  <div className="space-y-2">
                    {admins.map((admin) => (
                      <div key={admin.id} className="flex items-center justify-between p-2 hover:bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 rounded">
                        <div className="flex items-center gap-2">
                          <StorageAvatar
                            src={admin.user?.avatar_url}
                            fallback={admin.user?.full_name[0]}
                            className="h-8 w-8"
                          />
                          <div>
                            <p className="text-sm font-medium capitalize">{admin.user?.full_name}</p>
                            {admin.is_super_admin && (
                              <Badge variant="default" className="text-xs">Super Admin</Badge>
                            )}
                          </div>
                        </div>
                        {!admin.is_super_admin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeAdmin(admin.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {inLiveCall && currentLiveEvent && (
          <VideoCallRoom
            callTitle={currentLiveEvent.title}
            callType="live_stream"
            participants={liveParticipants}
            currentUserId={user!.id}
            onLeave={leaveLive}
          />
        )}
      </div>
    </div>
  );
}
