"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Lock, Globe, Send, ArrowLeft, Video, Radio, MessageCircle, Image as ImageIcon, Play, PhoneOff, Clock, Paperclip, Home, Mic, Square, X as XIcon, Camera, Trash2, MoreVertical, Link as LinkIcon, ChevronRight, Plus, Save, Archive, XCircle, GraduationCap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { VideoCallRoom } from '@/components/video-call-room';
import { uploadToUserMedia } from '@/lib/storage';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import { StorageImage } from '@/components/storage-image';
import { StorageVideo } from '@/components/storage-video';
import { StorageAudio } from '@/components/storage-audio';
import { StorageAvatar } from '@/components/storage-avatar';
import StartHereChat from '@/components/start-here-chat';
import { toast } from 'sonner';
import { LinkifyText } from '@/components/linkify-text';
import { CommunityChat } from '@/components/community-chat';

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  category: string | null;
  is_private: boolean;
  creator_id: string;
  member_count: number;
  created_at: string;
  user_role?: string;
}

interface Post {
  id: string;
  community_id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  media_type: string;
  channel_type: string;
  embedded_course_id: string | null;
  created_at: string;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    stage: string | null;
  };
  embedded_course?: {
    id: string;
    title: string;
    description: string | null;
    icon: string | null;
  };
}

interface Course {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  banner_url: string | null;
  order_index: number;
  created_at: string;
  lesson_count?: number;
  completed_count?: number;
}

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  content: string | null;
  order_index: number;
  duration_minutes: number | null;
  created_at: string;
  completed?: boolean;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    stage: string | null;
  };
}

interface ChatMessage {
  id: string;
  community_id: string;
  user_id: string;
  content: string;
  message_type: string;
  media_url?: string | null;
  call_duration?: number | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Call {
  id: string;
  community_id: string;
  creator_id: string;
  title: string;
  type: string;
  status: string;
  room_id: string;
  scheduled_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  creator?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function CommunityDetailClient() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const [community, setCommunity] = useState<Community | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [newPost, setNewPost] = useState('');
  const [newChatMessage, setNewChatMessage] = useState('');
  const [postMediaUrl, setPostMediaUrl] = useState('');
  const [postMediaType, setPostMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [postMediaFile, setPostMediaFile] = useState<File | null>(null);
  const [chatMediaUrl, setChatMediaUrl] = useState('');
  const [chatMediaType, setChatMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [chatMediaFile, setChatMediaFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingInterval = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [createCallOpen, setCreateCallOpen] = useState(false);
  const [newCall, setNewCall] = useState({
    title: '',
    type: 'video_call',
    scheduled_at: ''
  });
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [inCall, setInCall] = useState(false);
  const [startingLiveCall, setStartingLiveCall] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveOptions, setSaveOptions] = useState({
    saveRecording: false,
    saveAs: '' as 'workshop' | 'live_call' | '',
    callTitle: '',
    callDescription: ''
  });
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<'courses' | 'announcements' | 'start-here' | 'chat' | 'calls' | 'members' | 'learning-center' | 'workshops'>('courses');
  const [activeChannel, setActiveChannel] = useState<'announcement' | 'start-here' | 'general'>('general');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['courses', 'campus', 'chats']);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<any | null>(null);
  const [workshopPlayerOpen, setWorkshopPlayerOpen] = useState(false);
  const [deletingWorkshop, setDeletingWorkshop] = useState(false);
  const [announcementPosts, setAnnouncementPosts] = useState<Post[]>([]);
  const [startHerePosts, setStartHerePosts] = useState<Post[]>([]);
  const [embeddedCourseId, setEmbeddedCourseId] = useState<string | null>(null);
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [addCourseDialogOpen, setAddCourseDialogOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    icon: '',
    video_url: '',
    banner_url: ''
  });
  const [courseVideoFile, setCourseVideoFile] = useState<File | null>(null);
  const [courseBannerFile, setCourseBannerFile] = useState<File | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const startHereEndRef = useRef<HTMLDivElement>(null);

  const communityId = params.id as string;
  const isAdmin = community?.user_role === 'admin';
  const isOwner = community?.creator_id === user?.id;
  const activeCall = calls.find(call => call.id === activeCallId);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  useEffect(() => {
    if (!user) {
      router.push('/sign-in');
      return;
    }

    if (profile && !profile.profileCompleted) {
      router.push('/profile/setup');
      return;
    }

    // Set initial section to learning-center
    if (!hasInitialized) {
      setHasInitialized(true);
      setActiveSection('learning-center');
    }

    // Reset state when switching communities
    setCourses([]);
    setPosts([]);
    setAnnouncementPosts([]);
    setStartHerePosts([]);
    setChatMessages([]);

    loadCommunityData();
    loadChatMessages();

    const channel = supabase
      .channel(`community_chat:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'community_chat_messages',
          filter: `community_id=eq.${communityId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            loadChatMessages();
          } else if (payload.eventType === 'DELETE') {
            setChatMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, communityId, router]);

  const prevMessageCountRef = useRef<number>(0);

  useEffect(() => {
    if (chatMessages.length > prevMessageCountRef.current) {
      scrollChatToBottom();
    }
    prevMessageCountRef.current = chatMessages.length;
  }, [chatMessages]);

  const scrollChatToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadCommunityData = async () => {
    setLoading(true);
    console.log('Loading community data for communityId:', communityId);

    const [communityRes, membershipRes, postsRes, membersRes, callsRes, coursesRes, announcementsRes, startHereRes, workshopsRes] = await Promise.all([
      supabase.from('communities').select('*').eq('id', communityId).single(),
      supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', user!.id)
        .maybeSingle(),
      supabase
        .from('community_posts')
        .select(`
          *,
          author:author_id(id, full_name, avatar_url, stage)
        `)
        .eq('community_id', communityId)
        .eq('channel_type', 'general')
        .order('created_at', { ascending: false }),
      supabase
        .from('community_members')
        .select(`
          *,
          user:user_id(id, full_name, avatar_url, stage)
        `)
        .eq('community_id', communityId)
        .order('joined_at', { ascending: false }),
      supabase
        .from('community_calls')
        .select(`
          *,
          creator:creator_id(id, full_name, avatar_url)
        `)
        .eq('community_id', communityId)
        .neq('status', 'ended')
        .order('created_at', { ascending: false }),
      // Load courses with module counts
      supabase
        .from('community_courses')
        .select(`
          *,
          modules:community_modules(count)
        `)
        .eq('community_id', communityId)
        .order('order_index', { ascending: true }),
      // Load announcement posts
      supabase
        .from('community_posts')
        .select(`
          *,
          author:author_id(id, full_name, avatar_url, stage)
        `)
        .eq('community_id', communityId)
        .eq('channel_type', 'announcement')
        .order('created_at', { ascending: false }),
      // Load start-here posts
      supabase
        .from('community_posts')
        .select(`
          *,
          author:author_id(id, full_name, avatar_url, stage),
          embedded_course:embedded_course_id(id, title, description, icon)
        `)
        .eq('community_id', communityId)
        .eq('channel_type', 'start-here')
        .order('created_at', { ascending: true }),
      // Load workshops
      supabase
        .from('workshops')
        .select(`
          *
        `)
        .eq('community_id', communityId)
        .order('recorded_at', { ascending: false })
    ]);

    if (communityRes.data) {
      setCommunity({
        ...communityRes.data,
        user_role: membershipRes.data?.role
      });
    }

    if (postsRes.data) setPosts(postsRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    if (callsRes.data) setCalls(callsRes.data);

    console.log('Courses response for community', communityId, ':', { data: coursesRes.data, error: coursesRes.error, count: coursesRes.data?.length });
    if (coursesRes.data) {
      console.log('Setting courses for community', communityId, ':', coursesRes.data);
      setCourses(coursesRes.data);
    } else if (coursesRes.error) {
      console.error('Error loading courses for community', communityId, ':', coursesRes.error);
      setCourses([]);
    } else {
      console.log('No courses data for community', communityId);
      setCourses([]);
    }

    if (announcementsRes.data) setAnnouncementPosts(announcementsRes.data);
    if (startHereRes.data) setStartHerePosts(startHereRes.data);

    console.log('Workshops response:', { data: workshopsRes.data, error: workshopsRes.error, count: workshopsRes.data?.length });
    if (workshopsRes.data && workshopsRes.data.length > 0) {
      const hostIdsSet = new Set(workshopsRes.data.map((w: any) => w.host_id));
      const hostIds = Array.from(hostIdsSet);
      const { data: hostsData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', hostIds);

      const hostsMap = new Map(hostsData?.map(h => [h.id, h]) || []);
      const workshopsWithHosts = workshopsRes.data.map((workshop: any) => ({
        ...workshop,
        host: hostsMap.get(workshop.host_id)
      }));

      console.log('Setting workshops with hosts:', workshopsWithHosts);
      setWorkshops(workshopsWithHosts);
    } else if (workshopsRes.error) {
      console.error('Error loading workshops:', workshopsRes.error);
      setWorkshops([]);
    } else {
      console.log('No workshops data');
      setWorkshops([]);
    }

    await loadChatMessages();
    setLoading(false);
  };

  const loadChatMessages = async () => {
    const { data } = await supabase
      .from('community_chat_messages')
      .select(`
        *,
        user:user_id(id, full_name, avatar_url)
      `)
      .eq('community_id', communityId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) setChatMessages(data);
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    try {
      let fileToUpload = file;

      // Apply maximum compression for images only
      if (file.type.startsWith('image/')) {
        const settings = getCompressionSettings(file.size);
        fileToUpload = await compressImage(file, settings);
        console.log(`Image compressed: ${(file.size / 1024).toFixed(0)}KB -> ${(fileToUpload.size / 1024).toFixed(0)}KB`);
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${file.name}`;
      const result = await uploadToUserMedia(fileToUpload, user!.id, 'community-media', fileName, {
        compress: false, // Already compressed for images
      });
      return result.url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!isOwner || !community) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `community-avatars/${communityId}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('user-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-media')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('communities')
        .update({ avatar_url: publicUrl })
        .eq('id', communityId);

      if (updateError) throw updateError;

      setCommunity(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      setShowAvatarDialog(false);
      alert('Community picture updated successfully!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(error.message || 'Failed to upload community picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarUrlSubmit = async () => {
    if (!isOwner || !community || !avatarUrl.trim()) return;

    setUploadingAvatar(true);
    try {
      const { error: updateError } = await supabase
        .from('communities')
        .update({ avatar_url: avatarUrl })
        .eq('id', communityId);

      if (updateError) throw updateError;

      setCommunity(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
      setShowAvatarDialog(false);
      setAvatarUrl('');
      alert('Community picture updated successfully!');
    } catch (error: any) {
      console.error('Error updating avatar:', error);
      alert(error.message || 'Failed to update community picture');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const createPost = async () => {
    if ((!newPost.trim() && !postMediaUrl && !postMediaFile) || posting) return;

    // Check if admin for admin-only channels
    if ((activeChannel === 'announcement' || activeChannel === 'start-here') && !isAdmin) {
      alert('Only admins can post in this channel');
      return;
    }

    setPosting(true);

    let mediaUrl: string | null = postMediaUrl;
    if (postMediaFile) {
      setUploadingMedia(true);
      const uploadedUrl = await uploadFile(postMediaFile);
      setUploadingMedia(false);
      if (!uploadedUrl) {
        setPosting(false);
        return;
      }
      mediaUrl = uploadedUrl;
    }

    const postData: any = {
      community_id: communityId,
      author_id: user!.id,
      content: newPost.trim() || null,
      media_type: postMediaType,
      channel_type: activeChannel,
      embedded_course_id: embeddedCourseId
    };

    if (postMediaType === 'image') {
      postData.image_url = mediaUrl;
    } else if (postMediaType === 'video') {
      postData.video_url = mediaUrl;
    } else if (postMediaType === 'audio') {
      postData.audio_url = mediaUrl;
    }

    const { error } = await supabase.from('community_posts').insert(postData);

    if (!error) {
      setNewPost('');
      setPostMediaUrl('');
      setPostMediaFile(null);
      setPostMediaType('text');
      setEmbeddedCourseId(null);
      setShowCourseSelector(false);
      loadCommunityData();
    }

    setPosting(false);
  };

  const sendStartHereMessage = async (content: string, mediaFile: File | null, mediaType: string, embeddedCourseId: string | null) => {
    let mediaUrl: string | null = null;

    if (mediaFile) {
      setUploadingMedia(true);
      mediaUrl = await uploadFile(mediaFile);
      setUploadingMedia(false);
      if (!mediaUrl) return;
    }

    const postData: any = {
      community_id: communityId,
      author_id: user!.id,
      content: content.trim() || null,
      media_type: mediaType,
      channel_type: 'start-here',
      embedded_course_id: embeddedCourseId
    };

    if (mediaType === 'image') {
      postData.image_url = mediaUrl;
    } else if (mediaType === 'video') {
      postData.video_url = mediaUrl;
    } else if (mediaType === 'audio') {
      postData.audio_url = mediaUrl;
    }

    const { error } = await supabase.from('community_posts').insert(postData);

    if (!error) {
      loadCommunityData();
    }
  };

  const handleDeleteChatMessage = async () => {
    if (!messageToDelete) return;

    // Optimistically update UI
    setChatMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));

    const { error } = await supabase
      .from('community_chat_messages')
      .delete()
      .eq('id', messageToDelete);

    if (error) {
      console.error('Error deleting message:', error);
      // Reload messages on error to restore the UI
      loadChatMessages();
    }

    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const sendChatMessage = async () => {
    if (!newChatMessage.trim() && !chatMediaUrl && !chatMediaFile) return;

    let mediaUrl: string | null = chatMediaUrl;
    if (chatMediaFile) {
      setUploadingMedia(true);
      const uploadedUrl = await uploadFile(chatMediaFile);
      setUploadingMedia(false);
      if (!uploadedUrl) return;
      mediaUrl = uploadedUrl;
    }

    const messageData: any = {
      community_id: communityId,
      user_id: user!.id,
      content: newChatMessage.trim() || null,
      message_type: chatMediaType
    };

    if (chatMediaType === 'image' || chatMediaType === 'video' || chatMediaType === 'audio') {
      messageData.media_url = mediaUrl;
    }

    await supabase.from('community_chat_messages').insert(messageData);

    setNewChatMessage('');
    setChatMediaUrl('');
    setChatMediaFile(null);
    setChatMediaType('text');
    loadChatMessages();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        setChatMediaFile(audioFile);
        setChatMediaType('audio');
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      recordingInterval.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setIsRecording(false);
      setChatMediaFile(null);
      setChatMediaType('text');
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    }
  };

  const createCall = async () => {
    if (!newCall.title.trim()) return;

    const roomId = `${communityId}-${Date.now()}`;
    const callData: any = {
      community_id: communityId,
      creator_id: user!.id,
      title: newCall.title,
      type: newCall.type,
      room_id: roomId,
      status: newCall.scheduled_at ? 'scheduled' : 'active',
      scheduled_at: newCall.scheduled_at || null
    };

    if (!newCall.scheduled_at) {
      callData.started_at = new Date().toISOString();
    }

    const { error } = await supabase.from('community_calls').insert(callData);

    if (!error) {
      setCreateCallOpen(false);
      setNewCall({ title: '', type: 'video_call', scheduled_at: '' });
      loadCommunityData();
    }
  };

  const startCall = async (callId: string) => {
    await supabase
      .from('community_calls')
      .update({
        status: 'active',
        started_at: new Date().toISOString()
      })
      .eq('id', callId);
    loadCommunityData();
  };

  const openSaveDialog = () => {
    setSaveOptions({
      saveRecording: false,
      saveAs: '',
      callTitle: `${community?.name} Live Call`,
      callDescription: ''
    });
    setShowSaveDialog(true);
  };

  const startLiveCall = async () => {
    setShowSaveDialog(false);
    setStartingLiveCall(true);
    const roomId = `${communityId}-live-${Date.now()}`;
    const { data, error } = await supabase
      .from('community_calls')
      .insert({
        community_id: communityId,
        creator_id: user!.id,
        title: saveOptions.callTitle || `${community?.name} Live Call`,
        description: saveOptions.callDescription || null,
        type: 'video_call',
        room_id: roomId,
        status: 'active',
        started_at: new Date().toISOString(),
        save_recording: saveOptions.saveRecording,
        save_as: saveOptions.saveRecording ? saveOptions.saveAs || null : null
      })
      .select()
      .single();

    if (!error && data) {
      await loadCommunityData();
      joinCall(data.id);
    }
    setStartingLiveCall(false);
  };

  const endCall = async (callId: string) => {
    await supabase
      .from('community_calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString()
      })
      .eq('id', callId);
    loadCommunityData();
  };

  const joinCall = (callId: string) => {
    setActiveCallId(callId);
    setInCall(true);
  };

  const leaveCall = async () => {
    setActiveCallId(null);
    setInCall(false);
    await loadCommunityData();
  };

  const copyCommunityLink = async () => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'community',
      id: communityId as string,
    });

    if (success) {
      toast.success('Link copied!', {
        description: getCopySuccessMessage('community'),
      });
    } else {
      toast.error('Failed to copy link');
    }
  };

  const leaveCommunity = async () => {
    await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', user!.id);
    router.push('/communities');
  };

  const handleCreateCourse = async () => {
    if (!newCourse.title.trim()) {
      toast.error('Please enter a course title');
      return;
    }

    setCreatingCourse(true);
    try {
      let videoUrl = newCourse.video_url;
      let bannerUrl = newCourse.banner_url;

      if (courseVideoFile) {
        toast.loading('Uploading video...');
        const timestamp = Date.now();
        const fileName = `course_video_${timestamp}.${courseVideoFile.name.split('.').pop()}`;
        const result = await uploadToUserMedia(courseVideoFile, user!.id, 'courses', fileName);
        if (result) {
          videoUrl = result.url;
          toast.success('Video uploaded successfully');
        }
      }

      if (courseBannerFile) {
        toast.loading('Uploading banner...');
        const timestamp = Date.now();
        const fileName = `course_banner_${timestamp}.${courseBannerFile.name.split('.').pop()}`;
        const result = await uploadToUserMedia(courseBannerFile, user!.id, 'courses', fileName);
        if (result) {
          bannerUrl = result.url;
          toast.success('Banner uploaded successfully');
        }
      }

      toast.loading('Creating course...');
      const { error } = await supabase.from('community_courses').insert({
        community_id: communityId,
        title: newCourse.title,
        description: newCourse.description,
        icon: newCourse.icon || '📚',
        video_url: videoUrl,
        banner_url: bannerUrl,
        created_by: user!.id,
        order_index: courses.length
      });

      if (error) throw error;

      toast.success('Course created successfully!');
      setNewCourse({ title: '', description: '', icon: '', video_url: '', banner_url: '' });
      setCourseVideoFile(null);
      setCourseBannerFile(null);
      setAddCourseDialogOpen(false);
      await loadCommunityData();
    } catch (error) {
      console.error('Error creating course:', error);
      toast.error('Failed to create course. Please try again.');
    } finally {
      setCreatingCourse(false);
      toast.dismiss();
    }
  };

  const openWorkshopPlayer = async (workshop: any) => {
    console.log('Opening workshop:', workshop);
    console.log('Workshop video_url:', workshop.video_url);

    let resolvedWorkshop = { ...workshop };

    if (workshop.video_url) {
      if (workshop.video_url.startsWith('user-media:')) {
        const { resolveStorageUrl } = await import('@/lib/storage');
        const resolvedUrl = await resolveStorageUrl(workshop.video_url);
        console.log('Resolved storage URL:', resolvedUrl);
        resolvedWorkshop.video_url = resolvedUrl;
      }
    } else {
      console.warn('No video_url found for workshop');
    }

    console.log('Final resolved workshop:', resolvedWorkshop);
    setSelectedWorkshop(resolvedWorkshop);
    setWorkshopPlayerOpen(true);

    await supabase
      .from('workshop_views')
      .upsert({
        workshop_id: workshop.id,
        user_id: user!.id
      }, {
        onConflict: 'workshop_id,user_id'
      });
  };

  const deleteWorkshop = async (workshopId: string) => {
    if (!isAdmin) {
      toast.error('Only admins can delete workshops');
      return;
    }

    setDeletingWorkshop(true);
    try {
      const { error } = await supabase
        .from('workshops')
        .delete()
        .eq('id', workshopId);

      if (error) throw error;

      toast.success('Workshop deleted successfully');
      await loadCommunityData();
      setWorkshopPlayerOpen(false);
      setSelectedWorkshop(null);
    } catch (err) {
      toast.error('Failed to delete workshop');
      console.error('Error deleting workshop:', err);
    } finally {
      setDeletingWorkshop(false);
    }
  };

  if (inCall && activeCall) {
    return (
      <VideoCallRoom
        callTitle={activeCall.title}
        callType={activeCall.type as 'video_call' | 'live_stream'}
        participants={members.map(m => ({
          id: m.user_id,
          full_name: m.user?.full_name || '',
          avatar_url: m.user?.avatar_url || null
        }))}
        currentUserId={user!.id}
        communityId={communityId}
        callId={activeCall.id}
        isAdmin={isAdmin}
        onLeave={async () => {
          await leaveCall();
        }}
      />
    );
  }

  if (!user || !profile || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Community not found</h2>
          <p className="text-gray-300 mb-4">This community doesn't exist or you don't have access</p>
          <Button onClick={() => router.push('/communities')} className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">Back to Communities</Button>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex overflow-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-gray-900/95 backdrop-blur-lg border-r border-gray-800 transform transition-transform duration-300 lg:relative lg:transform-none ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex flex-col h-full">
          {/* Community Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-amber-500">
                <AvatarImage src={community.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-500 text-gray-900 text-sm font-bold">
                  {community.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-white truncate">{community.name}</h2>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Users className="h-3 w-3" />
                  {community.member_count} members
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyCommunityLink}
                className="text-gray-400 hover:text-amber-400 h-8 w-8 p-0"
              >
                <LinkIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-2 py-4">
            <div className="space-y-1">
              {/* Courses Section */}
              <div>
                <button
                  onClick={() => toggleCategory('courses')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider"
                >
                  <span className={`transition-transform ${expandedCategories.includes('courses') ? 'rotate-90' : ''}`}>▶</span>
                  Courses
                </button>
                {expandedCategories.includes('courses') && (
                  <div className="mt-1 space-y-0.5">
                    {(isAdmin || isOwner) && (
                      <button
                        onClick={() => setAddCourseDialogOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-amber-400 hover:bg-gray-800/50 hover:text-amber-300"
                      >
                        <span className="text-lg">➕</span>
                        <span className="flex-1 text-left">add-course</span>
                      </button>
                    )}
                    <button
                      onClick={() => setActiveSection('learning-center')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'learning-center'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">📚</span>
                      <span className="flex-1 text-left">learning-center</span>
                    </button>
                    {(() => { console.log('Rendering courses in sidebar:', courses); return null; })()}
                    {courses.map((course, index) => (
                      <button
                        key={course.id}
                        onClick={() => {
                          setActiveSection('courses');
                          router.push(`/communities/${communityId}/course/${course.id}`);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-400 hover:bg-gray-800/50 hover:text-gray-200`}
                      >
                        <span className="text-lg">{course.icon || '📚'}</span>
                        <span className="flex-1 text-left">{index + 1} - {course.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Campus Section */}
              <div className="mt-4">
                <button
                  onClick={() => toggleCategory('campus')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider"
                >
                  <span className={`transition-transform ${expandedCategories.includes('campus') ? 'rotate-90' : ''}`}>▶</span>
                  {community.name} Campus
                </button>
                {expandedCategories.includes('campus') && (
                  <div className="mt-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setActiveSection('start-here');
                        setActiveChannel('start-here');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'start-here'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">🎓</span>
                      <span>start-here</span>
                    </button>
                    <button
                      onClick={() => {
                        setActiveSection('announcements');
                        setActiveChannel('announcement');
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'announcements'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">📢</span>
                      <span>announcements</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Calls Section */}
              <div className="mt-4">
                <button
                  onClick={() => toggleCategory('calls')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider"
                >
                  <span className={`transition-transform ${expandedCategories.includes('calls') ? 'rotate-90' : ''}`}>▶</span>
                  Call Archive 📞
                </button>
                {expandedCategories.includes('calls') && (
                  <div className="mt-1 space-y-0.5">
                    <button
                      onClick={() => setActiveSection('calls')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors relative ${
                        activeSection === 'calls'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">📹</span>
                      <span>live-calls</span>
                      {calls.filter(c => c.status === 'active').length > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
                          LIVE
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveSection('workshops')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'workshops'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">🎬</span>
                      <span>workshops</span>
                      {workshops.length > 0 && (
                        <span className="ml-auto bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                          {workshops.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Chats Section */}
              <div className="mt-4">
                <button
                  onClick={() => toggleCategory('chats')}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-400 hover:text-gray-200 uppercase tracking-wider"
                >
                  <span className={`transition-transform ${expandedCategories.includes('chats') ? 'rotate-90' : ''}`}>▶</span>
                  Chats 💬
                </button>
                {expandedCategories.includes('chats') && (
                  <div className="mt-1 space-y-0.5">
                    <button
                      onClick={() => setActiveSection('chat')}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeSection === 'chat'
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">💬</span>
                      <span>general-chat</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Members Section */}
              <div className="mt-4">
                <button
                  onClick={() => setActiveSection('members')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === 'members'
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>Members</span>
                  <span className="ml-auto text-xs text-gray-500">{members.length}</span>
                </button>
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Actions */}
          <div className="p-4 border-t border-gray-800 space-y-2">
            {isOwner && !calls.some(c => c.status === 'active') && (
              <Button
                onClick={openSaveDialog}
                disabled={startingLiveCall}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
                size="sm"
              >
                <Radio className="h-4 w-4 mr-2" />
                {startingLiveCall ? 'Starting...' : 'Go Live'}
              </Button>
            )}
            <Button
              onClick={() => router.push('/communities')}
              variant="outline"
              size="sm"
              className="w-full bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Communities
            </Button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-400 hover:text-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-amber-400 lg:hidden"
            >
              <Users className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex items-center gap-2">
              <span className="text-lg">
                {activeSection === 'courses' ? '📚' :
                 activeSection === 'chat' ? '💬' :
                 activeSection === 'announcements' ? '📢' :
                 activeSection === 'start-here' ? '🎓' :
                 activeSection === 'calls' ? '📹' :
                 activeSection === 'workshops' ? '🎬' : '👥'}
              </span>
              <h1 className="text-lg font-bold text-gray-100 truncate">
                {activeSection === 'courses' ? 'Courses' :
                 activeSection === 'chat' ? 'general-chat' :
                 activeSection === 'announcements' ? 'announcements' :
                 activeSection === 'start-here' ? 'start-here' :
                 activeSection === 'calls' ? 'Calls' :
                 activeSection === 'workshops' ? 'Workshops' : 'Members'}
              </h1>
            </div>
            <Link href="/feed" className="text-gray-400 hover:text-amber-400 p-2">
              <Home className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 py-4">

        {/* Active Call Banner */}
        {calls.filter(call => call.status === 'active').map((activeCall) => (
          <Card key={activeCall.id} className="mb-6 border-2 border-green-500 bg-green-900/40">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {activeCall.type === 'live_stream' ? (
                      <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                        <Radio className="h-6 w-6 text-white" />
                      </div>
                    ) : (
                      <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                        <Video className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-100">{activeCall.title}</h3>
                    <p className="text-sm text-gray-300">
                      {activeCall.type === 'live_stream' ? 'Live Stream' : 'Video Call'} is now active
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => joinCall(activeCall.id)}
                >
                  <Play className="h-5 w-5 mr-2" />
                  Join Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Courses List View */}
        {activeSection === 'courses' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-100">Courses</h2>
            </div>

            {courses.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">📚</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">No courses yet</h3>
                      <p className="text-gray-400 text-sm">
                        {isAdmin ? 'Create your first course to get started' : 'The community admin will add courses soon'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {courses.map((course, index) => (
                  <Card key={course.id} className="bg-gray-900/60 border-gray-800 hover:border-amber-500/50 transition-colors cursor-pointer" onClick={() => router.push(`/communities/${communityId}/course/${course.id}`)}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-3xl flex-shrink-0 border-2 border-gray-700">
                          {course.icon || '📚'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-100 mb-2">
                            {index + 1} - {course.title}
                          </h3>
                          {course.description && (
                            <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                              {course.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="w-full bg-gray-800 rounded-full h-2 mb-1">
                                <div
                                  className="bg-gradient-to-r from-amber-500 to-yellow-500 h-2 rounded-full transition-all"
                                  style={{ width: `${course.completed_count && course.lesson_count ? (course.completed_count / course.lesson_count) * 100 : 0}%` }}
                                />
                              </div>
                              <p className="text-xs text-gray-500">
                                {course.completed_count && course.lesson_count
                                  ? `${Math.round((course.completed_count / course.lesson_count) * 100)}% complete`
                                  : '0% complete'}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="bg-gray-800 text-amber-400 hover:bg-gray-700 border border-amber-500/30"
                            >
                              Start Course →
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Announcements Section */}
        {activeSection === 'announcements' && (
          <div className="space-y-6">
            {isAdmin && (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-4">
                  <Textarea
                    placeholder="Make an announcement..."
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                    rows={3}
                    className="mb-3 bg-gray-800 border-gray-700 text-gray-300 placeholder:text-gray-500"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={createPost}
                      disabled={!newPost.trim() || posting}
                      size="sm"
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Post Announcement
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {announcementPosts.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">📢</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">No announcements yet</h3>
                      <p className="text-gray-400 text-sm">Check back later for important updates</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {announcementPosts.map((post) => (
                  <Card key={post.id} className="bg-gray-900 border-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 border-2 border-amber-500">
                          <AvatarImage src={post.author?.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-500 text-gray-900">
                            {post.author?.full_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-gray-100">{post.author?.full_name}</h4>
                            <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 text-xs">Admin</Badge>
                          </div>
                          <p className="text-sm text-gray-400 mb-3">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                          </p>
                          <p className="text-gray-300 whitespace-pre-wrap">{post.content}</p>
                          {post.image_url && (
                            <div className="relative w-full h-96 mt-4">
                              <Image src={post.image_url} alt="Post" fill className="rounded-lg object-cover border border-gray-800" />
                            </div>
                          )}
                          {post.video_url && (
                            <div className="mt-4">
                              <video src={post.video_url} controls className="rounded-lg max-w-full border border-gray-800" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Learning Center Section */}
        {activeSection === 'learning-center' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-3xl">📚</span>
                Learning Center
              </h2>
            </div>
            <p className="text-gray-400 text-sm">
              Browse all courses available in {community?.name}
            </p>
            {courses.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-12 text-center">
                  <div className="mb-4">
                    <span className="text-6xl">📚</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">No courses yet</h3>
                  <p className="text-gray-400 mb-4">
                    {isAdmin ? 'Create your first course to get started!' : 'Check back later for new courses.'}
                  </p>
                  {isAdmin && (
                    <Button
                      onClick={() => setAddCourseDialogOpen(true)}
                      className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Course
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {courses.map((course, index) => (
                  <Card key={course.id} className="bg-gray-900/80 border-gray-800 hover:border-gray-700 transition-all group overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-20 w-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center text-4xl shadow-lg flex-shrink-0">
                          {course.icon || '📚'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xl font-bold text-white mb-1">
                                {index + 1} - {course.title}
                              </h3>
                              <p className="text-sm text-gray-400 line-clamp-2">
                                {course.description || 'No description available'}
                              </p>
                            </div>
                          </div>
                          <div className="mt-4 mb-3">
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 transition-all duration-300"
                                style={{
                                  width: `${course.completed_count && course.lesson_count
                                    ? Math.round((course.completed_count / course.lesson_count) * 100)
                                    : 0}%`
                                }}
                              />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              {course.completed_count && course.lesson_count
                                ? `${Math.round((course.completed_count / course.lesson_count) * 100)}% complete`
                                : '0% complete'}
                            </p>
                          </div>
                          <Button
                            onClick={() => router.push(`/communities/${communityId}/course/${course.id}`)}
                            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 group-hover:border-amber-500/50 transition-all"
                          >
                            Start Course
                            <ChevronRight className="h-4 w-4 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Start-Here Section */}
        {activeSection === 'start-here' && (
          <StartHereChat
            posts={startHerePosts}
            isAdmin={isAdmin}
            courses={courses}
            communityId={communityId}
            onSendMessage={sendStartHereMessage}
            sending={posting || uploadingMedia}
          />
        )}

        {/* Chat Section */}
        {activeSection === 'chat' && (
          <Card className="h-[calc(100vh-200px)] flex flex-col bg-gray-950 border-gray-800">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
              <CommunityChat
                communityId={communityId}
                communityName={community.name}
              />
            </CardContent>
          </Card>
        )}

        {/* Calls Section */}
        {activeSection === 'calls' && (
          <div className="space-y-4">
            {calls.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">📹</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">No calls yet</h3>
                      <p className="text-gray-600 text-sm">
                        {isAdmin ? 'Start your first video call or live stream' : 'The community admin will start calls and streams'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {calls.map((call) => (
                  <Card key={call.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          {call.type === 'live_stream' ? (
                            <div className="h-12 w-12 bg-red-100 rounded-lg flex items-center justify-center">
                              <Radio className="h-6 w-6 text-red-600" />
                            </div>
                          ) : (
                            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Video className="h-6 w-6 text-blue-600" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg text-gray-900">{call.title}</h3>
                              <Badge
                                variant={call.status === 'active' ? 'default' : 'secondary'}
                                className={call.status === 'active' ? 'bg-green-600' : ''}
                              >
                                {call.status}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {call.type === 'live_stream' ? 'Live Stream' : 'Video Call'} by {call.creator?.full_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {call.started_at
                                ? `Started ${formatDistanceToNow(new Date(call.started_at), { addSuffix: true })}`
                                : `Created ${formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {call.status === 'active' && (
                            <Button size="sm" onClick={() => joinCall(call.id)}>
                              <Play className="h-4 w-4 mr-2" />
                              Join
                            </Button>
                          )}
                          {isAdmin && call.status === 'scheduled' && (
                            <Button onClick={() => startCall(call.id)} size="sm">
                              Start
                            </Button>
                          )}
                          {isAdmin && call.status === 'active' && (
                            <Button onClick={() => endCall(call.id)} variant="outline" size="sm">
                              End
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Workshops Section */}
        {activeSection === 'workshops' && (
          <div className="space-y-4">
            {workshops.length === 0 ? (
              <Card className="bg-gray-950 border-gray-800">
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">🎬</div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">No workshops yet</h3>
                      <p className="text-gray-400 text-sm">
                        Ended calls and live streams will appear here
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {workshops.map((workshop) => {
                  const minutes = Math.floor(workshop.duration / 60);
                  const seconds = workshop.duration % 60;
                  const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

                  return (
                    <Card key={workshop.id} className="bg-gray-950 border-gray-800 hover:border-amber-500/30 transition-colors">
                      <CardContent className="p-0">
                        <div
                          onClick={() => openWorkshopPlayer(workshop)}
                          className="aspect-video bg-gray-900 flex items-center justify-center relative overflow-hidden cursor-pointer group"
                        >
                          {workshop.thumbnail_url ? (
                            <Image src={workshop.thumbnail_url} alt={workshop.title} fill className="object-cover" />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Video className="h-16 w-16 text-gray-700" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="h-16 w-16 text-white" />
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs text-white">
                            {durationText}
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-white mb-2 line-clamp-2 flex-1">{workshop.title}</h3>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteWorkshop(workshop.id);
                                }}
                                disabled={deletingWorkshop}
                                className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-400">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={workshop.host?.avatar_url || undefined} />
                              <AvatarFallback className="bg-amber-600 text-white text-xs">
                                {workshop.host?.full_name?.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span>{workshop.host?.full_name}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Recorded {formatDistanceToNow(new Date(workshop.recorded_at), { addSuffix: true })}
                          </p>
                          {workshop.views > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              {workshop.views} view{workshop.views !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Members Section */}
        {activeSection === 'members' && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {members.map((member) => (
                <Card key={member.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.user?.avatar_url || undefined} />
                        <AvatarFallback className="bg-blue-100 text-blue-600">
                          {member.user?.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {member.user?.full_name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          {member.user?.stage && (
                            <Badge variant="secondary" className="text-xs">
                              {member.user.stage}
                            </Badge>
                          )}
                          {member.role === 'admin' && (
                            <Badge className="text-xs bg-blue-600">Admin</Badge>
                          )}
                          {member.role === 'moderator' && (
                            <Badge className="text-xs bg-green-600">Moderator</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

          </div>
        </div>
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
              onClick={handleDeleteChatMessage}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Course Dialog */}
      <Dialog open={addCourseDialogOpen} onOpenChange={setAddCourseDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Create New Course</DialogTitle>
            <DialogDescription className="text-gray-400">
              Add a new course to your community. Upload a video and banner to make it engaging.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="course-title">Course Title *</Label>
              <Input
                id="course-title"
                placeholder="e.g., Introduction to AI"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="course-description">Description</Label>
              <Textarea
                id="course-description"
                placeholder="Describe what students will learn..."
                value={newCourse.description}
                onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="course-icon">Icon Emoji (optional)</Label>
              <Input
                id="course-icon"
                placeholder="e.g., 🎓"
                value={newCourse.icon}
                onChange={(e) => setNewCourse({ ...newCourse, icon: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <Label htmlFor="course-banner">Course Banner Image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="course-banner"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCourseBannerFile(file);
                  }}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                {courseBannerFile && (
                  <Badge variant="secondary" className="bg-green-600">
                    {courseBannerFile.name}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="course-video">Course Intro Video</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="course-video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCourseVideoFile(file);
                  }}
                  className="bg-gray-800 border-gray-700 text-white"
                />
                {courseVideoFile && (
                  <Badge variant="secondary" className="bg-green-600">
                    {courseVideoFile.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAddCourseDialogOpen(false);
                setNewCourse({ title: '', description: '', icon: '', video_url: '', banner_url: '' });
                setCourseVideoFile(null);
                setCourseBannerFile(null);
              }}
              className="bg-gray-800 text-gray-100 hover:bg-gray-700 border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateCourse}
              disabled={creatingCourse || !newCourse.title.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {creatingCourse ? 'Creating...' : 'Create Course'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Options Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="bg-gray-900 text-gray-100 border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Live Call Options</DialogTitle>
            <DialogDescription className="text-gray-400">
              Configure your call details and choose what happens after it ends
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div>
              <Label htmlFor="call-title">Call Title</Label>
              <Input
                id="call-title"
                value={saveOptions.callTitle}
                onChange={(e) => setSaveOptions({...saveOptions, callTitle: e.target.value})}
                placeholder="Enter call title"
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>

            <div>
              <Label htmlFor="call-description">Description (Optional)</Label>
              <Textarea
                id="call-description"
                value={saveOptions.callDescription}
                onChange={(e) => setSaveOptions({...saveOptions, callDescription: e.target.value})}
                placeholder="Describe what this call is about"
                className="bg-gray-800 border-gray-700 text-gray-100"
                rows={3}
              />
            </div>

            <div>
              <Label className="mb-3 block">Save Options</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setSaveOptions({...saveOptions, saveRecording: false, saveAs: ''})}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    !saveOptions.saveRecording
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <XCircle className={`h-8 w-8 ${!saveOptions.saveRecording ? 'text-amber-500' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">Don't Save</span>
                    <span className="text-xs text-gray-400 text-center">Call won't be archived</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveOptions({...saveOptions, saveRecording: true, saveAs: 'workshop'})}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    saveOptions.saveRecording && saveOptions.saveAs === 'workshop'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <GraduationCap className={`h-8 w-8 ${
                      saveOptions.saveRecording && saveOptions.saveAs === 'workshop' ? 'text-amber-500' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-medium">Workshop</span>
                    <span className="text-xs text-gray-400 text-center">Save in Workshops</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSaveOptions({...saveOptions, saveRecording: true, saveAs: 'live_call'})}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    saveOptions.saveRecording && saveOptions.saveAs === 'live_call'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Archive className={`h-8 w-8 ${
                      saveOptions.saveRecording && saveOptions.saveAs === 'live_call' ? 'text-amber-500' : 'text-gray-400'
                    }`} />
                    <span className="text-sm font-medium">Live Archive</span>
                    <span className="text-xs text-gray-400 text-center">Save in Live Calls</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowSaveDialog(false)}
              className="bg-gray-800 text-gray-100 hover:bg-gray-700 border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={startLiveCall}
              disabled={startingLiveCall || !saveOptions.callTitle.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {startingLiveCall ? 'Starting...' : 'Start Live Call'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Workshop Player Dialog */}
      <Dialog open={workshopPlayerOpen} onOpenChange={setWorkshopPlayerOpen}>
        <DialogContent className="max-w-5xl bg-gray-950 border-gray-800 text-white p-0">
          <div className="relative">
            {selectedWorkshop?.video_url ? (
              <div className="aspect-video bg-black">
                <StorageVideo
                  src={selectedWorkshop.video_url}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="aspect-video bg-gray-900 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Video className="h-16 w-16 text-gray-700 mx-auto" />
                  <p className="text-gray-400">No video available for this workshop</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-2">{selectedWorkshop?.title}</h2>
                {selectedWorkshop?.description && (
                  <p className="text-gray-400 text-sm mb-3">{selectedWorkshop.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-2">
                    <StorageAvatar
                      src={selectedWorkshop?.host?.avatar_url}
                      alt={selectedWorkshop?.host?.full_name}
                      fallback={selectedWorkshop?.host?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                      className="h-8 w-8"
                    />
                    <span>{selectedWorkshop?.host?.full_name}</span>
                  </div>
                  <span>•</span>
                  <span>
                    {selectedWorkshop?.recorded_at &&
                      formatDistanceToNow(new Date(selectedWorkshop.recorded_at), { addSuffix: true })
                    }
                  </span>
                  {selectedWorkshop?.views > 0 && (
                    <>
                      <span>•</span>
                      <span>{selectedWorkshop.views} view{selectedWorkshop.views !== 1 ? 's' : ''}</span>
                    </>
                  )}
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedWorkshop && deleteWorkshop(selectedWorkshop.id)}
                  disabled={deletingWorkshop}
                  className="border-red-600 text-red-400 hover:bg-red-950/50 hover:text-red-300"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
