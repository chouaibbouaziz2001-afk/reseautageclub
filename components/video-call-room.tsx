"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  X,
  MessageSquare,
  Send,
  Pin,
  Trash2,
  MessageCircleOff,
  MessageCircle,
  ChevronLeft
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  user: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  parent_id: string | null;
  replies?: Comment[];
}

interface VideoCallRoomProps {
  callTitle: string;
  callType: 'video_call' | 'live_stream';
  participants: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
  }>;
  currentUserId: string;
  communityId?: string;
  callId?: string;
  isAdmin?: boolean;
  onLeave: () => void;
}

export function VideoCallRoom({
  callTitle,
  callType,
  participants,
  currentUserId,
  communityId,
  callId,
  isAdmin = false,
  onLeave
}: VideoCallRoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const callStartTime = useRef<Date>(new Date());

  const adminParticipants = participants.filter(p =>
    p.id === currentUserId && isAdmin
  );

  useEffect(() => {
    if (isAdmin) {
      startLocalStream();
    }
    callStartTime.current = new Date();

    if (callId) {
      loadCallSettings();
      loadComments();

      const commentsSub = supabase
        .channel(`call-comments-${callId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'call_comments',
            filter: `call_id=eq.${callId}`
          },
          () => {
            loadComments();
          }
        )
        .subscribe();

      const callSub = supabase
        .channel(`call-settings-${callId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'community_calls',
            filter: `id=eq.${callId}`
          },
          (payload) => {
            if (payload.new && 'comments_enabled' in payload.new) {
              setCommentsEnabled(payload.new.comments_enabled);
            }
          }
        )
        .subscribe();

      return () => {
        if (isAdmin) {
          stopLocalStream();
        }
        commentsSub.unsubscribe();
        callSub.unsubscribe();
      };
    }

    return () => {
      if (isAdmin) {
        stopLocalStream();
      }
    };
  }, [callId, isAdmin]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  const loadCallSettings = async () => {
    if (!callId) return;
    const { data } = await supabase
      .from('community_calls')
      .select('comments_enabled')
      .eq('id', callId)
      .single();

    if (data) {
      setCommentsEnabled(data.comments_enabled);
    }
  };

  const loadComments = async () => {
    if (!callId) return;
    console.log('Loading comments for call:', callId);
    const { data, error } = await supabase
      .from('call_comments')
      .select(`
        *,
        user:user_id(id, full_name, avatar_url)
      `)
      .eq('call_id', callId)
      .is('parent_id', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading comments:', error);
      return;
    }

    console.log('Loaded comments:', data);

    if (data) {
      const commentsWithReplies = await Promise.all(
        data.map(async (comment) => {
          const { data: replies } = await supabase
            .from('call_comments')
            .select(`
              *,
              user:user_id(id, full_name, avatar_url)
            `)
            .eq('parent_id', comment.id)
            .order('created_at', { ascending: true });

          return {
            ...comment,
            replies: replies || []
          };
        })
      );
      console.log('Comments with replies:', commentsWithReplies);
      setComments(commentsWithReplies as Comment[]);
    }
  };

  const startLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setLocalStream(stream);

      if (isAdmin) {
        startRecording(stream);
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
    }
  };

  const startRecording = async (stream: MediaStream) => {
    try {
      console.log('Starting recording with stream:', stream);
      console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, muted: t.muted })));

      recordedChunksRef.current = [];

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        console.log('VP9 not supported, trying vp8');
        mimeType = 'video/webm;codecs=vp8';

        if (!MediaRecorder.isTypeSupported(mimeType)) {
          console.log('VP8 not supported, using default webm');
          mimeType = 'video/webm';
        }
      }

      console.log('Using mimeType:', mimeType);
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorder.ondataavailable = (event) => {
        console.log('ondataavailable fired, data size:', event.data?.size || 0);
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
          console.log('✅ Data chunk received:', event.data.size, 'bytes. Total chunks:', recordedChunksRef.current.length);
        }
      };

      mediaRecorder.onstart = () => {
        console.log('✅ MediaRecorder started successfully, state:', mediaRecorder.state);
        const { toast } = require('sonner');
        toast.success('🔴 Recording started!', { duration: 2000 });
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped, total chunks:', recordedChunksRef.current.length);
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('❌ MediaRecorder error:', event);
        const { toast } = require('sonner');
        toast.error('Recording error occurred');
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      console.log('Recording start() called, initial state:', mediaRecorder.state);
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      const { toast } = require('sonner');
      toast.error('Failed to start recording: ' + (error as Error).message);
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const mediaRecorder = mediaRecorderRef.current;

      console.log('stopRecording called');
      console.log('mediaRecorder:', mediaRecorder);
      console.log('mediaRecorder state:', mediaRecorder?.state);
      console.log('recordedChunksRef.current length:', recordedChunksRef.current.length);

      if (!mediaRecorder) {
        console.warn('No mediaRecorder found');
        resolve(null);
        return;
      }

      if (mediaRecorder.state === 'inactive') {
        console.warn('MediaRecorder already inactive');
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        console.log('Creating blob from existing chunks, size:', blob.size);
        setIsRecording(false);
        resolve(blob.size > 0 ? blob : null);
        return;
      }

      mediaRecorder.onstop = () => {
        console.log('onstop event fired, chunks:', recordedChunksRef.current.length);
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setIsRecording(false);
        console.log('✅ Recording stopped, blob size:', blob.size, 'bytes');
        resolve(blob.size > 0 ? blob : null);
      };

      console.log('Calling mediaRecorder.stop()');
      mediaRecorder.stop();

      setTimeout(() => {
        if (mediaRecorder.state !== 'inactive') {
          console.warn('MediaRecorder did not stop in time, forcing...');
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          setIsRecording(false);
          resolve(blob.size > 0 ? blob : null);
        }
      }, 3000);
    });
  };

  const stopLocalStream = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
  };

  const toggleMute = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      startLocalStream();
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          startLocalStream();
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (error) {
        console.error('Error sharing screen:', error);
      }
    }
  };

  const toggleComments = async () => {
    if (!callId || !isAdmin) return;

    const newState = !commentsEnabled;
    await supabase
      .from('community_calls')
      .update({ comments_enabled: newState })
      .eq('id', callId);

    setCommentsEnabled(newState);
  };

  const sendComment = async () => {
    if (!newComment.trim() || !callId || !commentsEnabled) {
      console.log('Cannot send comment:', { hasContent: !!newComment.trim(), callId, commentsEnabled });
      return;
    }

    const commentContent = newComment.trim();
    const parentId = replyingTo?.id || null;

    console.log('Sending comment:', { commentContent, callId, currentUserId, parentId });

    const currentUser = participants.find(p => p.id === currentUserId);
    if (!currentUser) {
      console.error('Current user not found in participants');
      return;
    }

    setNewComment('');
    setReplyingTo(null);

    const { data: insertedComment, error } = await supabase
      .from('call_comments')
      .insert({
        call_id: callId,
        user_id: currentUserId,
        content: commentContent,
        parent_id: parentId
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error sending comment:', error);
      return;
    }

    console.log('Comment inserted:', insertedComment);

    if (insertedComment) {
      const commentWithUser = {
        ...insertedComment,
        user: {
          id: currentUser.id,
          full_name: currentUser.full_name,
          avatar_url: currentUser.avatar_url
        },
        replies: []
      };

      console.log('Comment with user data:', commentWithUser);

      if (parentId) {
        setComments(prevComments => {
          const updated = prevComments.map(comment =>
            comment.id === parentId
              ? { ...comment, replies: [...(comment.replies || []), commentWithUser] }
              : comment
          );
          console.log('Updated comments with reply:', updated);
          return updated;
        });
      } else {
        setComments(prevComments => {
          const updated = [...prevComments, commentWithUser];
          console.log('Updated comments with new comment:', updated);
          return updated;
        });
      }
    }
  };

  const togglePin = async (commentId: string, isPinned: boolean) => {
    if (!isAdmin) return;

    setComments(prevComments =>
      prevComments.map(comment =>
        comment.id === commentId
          ? { ...comment, is_pinned: !isPinned }
          : comment
      )
    );

    await supabase
      .from('call_comments')
      .update({ is_pinned: !isPinned })
      .eq('id', commentId);
  };

  const deleteComment = async (commentId: string) => {
    setComments(prevComments =>
      prevComments
        .filter(comment => comment.id !== commentId)
        .map(comment => ({
          ...comment,
          replies: comment.replies?.filter(reply => reply.id !== commentId) || []
        }))
    );

    await supabase
      .from('call_comments')
      .delete()
      .eq('id', commentId);
  };

  const handleLeave = async () => {
    const callEndTime = new Date();
    const durationInSeconds = Math.floor((callEndTime.getTime() - callStartTime.current.getTime()) / 1000);

    if (isAdmin) {
      stopLocalStream();
    }

    if (communityId && callId && isAdmin) {
      try {
        const { data: callData } = await supabase
          .from('community_calls')
          .select('title, type, save_recording, save_as, description')
          .eq('id', callId)
          .single();

        await supabase
          .from('community_calls')
          .update({
            status: 'ended',
            ended_at: callEndTime.toISOString(),
            duration: durationInSeconds
          })
          .eq('id', callId);

        const minutes = Math.floor(durationInSeconds / 60);
        const seconds = durationInSeconds % 60;
        const durationText = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

        if (callData?.save_recording) {
          if (callData.save_as === 'workshop') {
            let videoUrl: string | null = null;

            console.log('isRecording:', isRecording);
            console.log('mediaRecorderRef.current:', mediaRecorderRef.current);
            console.log('recordedChunksRef.current length:', recordedChunksRef.current.length);

            if (isRecording) {
              console.log('Stopping recording...');
              const recordedBlob = await stopRecording();
              console.log('Recording stopped. Blob:', recordedBlob ? `${recordedBlob.size} bytes` : 'null');

              if (recordedBlob && recordedBlob.size > 0) {
                try {
                  const { uploadToUserMedia } = await import('@/lib/storage');
                  const { toast } = await import('sonner');

                  toast.info('Uploading workshop video...');
                  const timestamp = Date.now();
                  const fileName = `workshop_${callId}_${timestamp}.webm`;
                  const file = new File([recordedBlob], fileName, { type: 'video/webm' });

                  console.log('Uploading video file:', fileName, 'size:', file.size);
                  const result = await uploadToUserMedia(file, currentUserId, 'workshops', fileName, { compress: false });

                  if (result) {
                    videoUrl = result.url;
                    console.log('Workshop video uploaded successfully:', videoUrl);
                    toast.success('Workshop video uploaded!');
                  } else {
                    console.error('Upload result was null');
                    toast.error('Failed to upload video');
                  }
                } catch (uploadError) {
                  console.error('Error uploading video:', uploadError);
                  const { toast } = await import('sonner');
                  toast.error('Failed to upload workshop video');
                }
              } else {
                console.warn('No recorded data or empty blob');
                const { toast } = await import('sonner');
                toast.warning('Recording produced no data. Using demo video.');
                videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
              }
            } else {
              console.warn('isRecording is false, no recording to save');
              const { toast } = await import('sonner');
              toast.warning('Recording did not start. Using demo video.');
              videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
            }

            await supabase
              .from('workshops')
              .insert({
                community_id: communityId,
                call_id: callId,
                title: callData.title || callTitle,
                description: callData.description,
                duration: durationInSeconds,
                host_id: currentUserId,
                recorded_at: callStartTime.current.toISOString(),
                video_url: videoUrl
              });

            await supabase
              .from('community_chat_messages')
              .insert({
                community_id: communityId,
                user_id: currentUserId,
                content: `${callType === 'live_stream' ? 'Live stream' : 'Video call'} ended. Duration: ${durationText}. Now available in Workshops!`,
                message_type: 'call_ended',
                call_duration: durationInSeconds
              });
          } else if (callData.save_as === 'live_call') {
            await supabase
              .from('community_chat_messages')
              .insert({
                community_id: communityId,
                user_id: currentUserId,
                content: `${callType === 'live_stream' ? 'Live stream' : 'Video call'} ended. Duration: ${durationText}. Saved in Live Calls Archive!`,
                message_type: 'call_ended',
                call_duration: durationInSeconds
              });
          }
        } else {
          await supabase
            .from('community_chat_messages')
            .insert({
              community_id: communityId,
              user_id: currentUserId,
              content: `${callType === 'live_stream' ? 'Live stream' : 'Video call'} ended. Duration: ${durationText}.`,
              message_type: 'call_ended',
              call_duration: durationInSeconds
            });
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('Error saving call history:', error);
      }
    }

    onLeave();
  };

  const CommentItem = ({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) => (
    <div className={`${isReply ? 'ml-8 mt-2' : 'mb-4'}`}>
      <div className={`flex gap-2 ${comment.is_pinned ? 'bg-yellow-900/20 border border-yellow-700/30 rounded-lg p-3' : ''}`}>
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.user.avatar_url || undefined} />
          <AvatarFallback className="bg-blue-600 text-white text-xs">
            {comment.user.full_name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white">{comment.user.full_name}</span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
            {comment.is_pinned && (
              <Badge className="bg-yellow-600 text-white text-xs">Pinned</Badge>
            )}
          </div>
          <p className="text-sm text-gray-300">{comment.content}</p>
          <div className="flex gap-2 mt-2">
            {!isReply && (
              <button
                onClick={() => setReplyingTo(comment)}
                className="text-xs text-gray-400 hover:text-amber-400"
              >
                Reply
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => togglePin(comment.id, comment.is_pinned)}
                  className="text-xs text-gray-400 hover:text-yellow-400 flex items-center gap-1"
                >
                  <Pin className="h-3 w-3" />
                  {comment.is_pinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => deleteComment(comment.id)}
                  className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
            {comment.user.id === currentUserId && !isAdmin && (
              <button
                onClick={() => deleteComment(comment.id)}
                className="text-xs text-gray-400 hover:text-red-400 flex items-center gap-1"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map(reply => (
            <CommentItem key={reply.id} comment={reply} isReply />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <div className="fixed inset-0 z-50 w-screen bg-gray-950" style={{ height: '100dvh' }}>
        <div className="absolute top-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between z-30">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-xl font-semibold text-white truncate">{callTitle}</h2>
            {isRecording && (
              <Badge variant="destructive" className="flex items-center gap-1 animate-pulse">
                <div className="h-2 w-2 rounded-full bg-white" />
                REC
              </Badge>
            )}
          </div>
          <p className="text-xs md:text-sm text-gray-400">
            {callType === 'live_stream' ? 'Live Stream' : 'Video Call'} • {participants.length} participant{participants.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLeave}
          className="text-gray-400 hover:text-white flex-shrink-0 ml-2"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex h-full pt-16 pb-20">
        <div className={`flex-1 flex items-center justify-center p-4 ${showChat ? 'lg:mr-96' : ''}`}>
          {isAdmin ? (
            <div className="w-full max-w-4xl">
              <div className="relative w-full bg-gray-900 border-2 border-amber-500/30 overflow-hidden rounded-xl" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <Avatar className="h-32 w-32">
                      <AvatarFallback className="bg-amber-600 text-white text-4xl">
                        {participants.find(p => p.id === currentUserId)?.full_name.split(' ').map(n => n[0]).join('') || 'A'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/70 px-4 py-2 rounded-full">
                  <span className="text-white font-medium">
                    {participants.find(p => p.id === currentUserId)?.full_name || 'You'} (Host)
                  </span>
                </div>
                {isScreenSharing && (
                  <div className="absolute top-4 right-4 bg-green-600 px-3 py-1.5 rounded-full">
                    <span className="text-white text-sm font-medium">Sharing Screen</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center">
              <div className="mb-6">
                <MessageSquare className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Watching Live</h3>
                <p className="text-gray-400">
                  Use the chat to ask questions and interact with the host
                </p>
              </div>
            </div>
          )}
        </div>

        {showChat && (
          <div className="fixed right-0 top-16 bottom-20 w-96 bg-gray-900 border-l border-gray-800 flex flex-col">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-amber-400" />
                <h3 className="font-semibold text-white">Q&A</h3>
                <Badge className="bg-gray-800 text-gray-300">{comments.length}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleComments}
                        className={commentsEnabled ? 'text-green-400' : 'text-red-400'}
                      >
                        {commentsEnabled ? <MessageCircle className="h-4 w-4" /> : <MessageCircleOff className="h-4 w-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {commentsEnabled ? 'Disable comments' : 'Enable comments'}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowChat(false)}
                  className="text-gray-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 p-4">
              {comments.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No questions yet</p>
                  <p className="text-gray-600 text-xs mt-1">Be the first to ask!</p>
                </div>
              ) : (
                <>
                  {comments.filter(c => c.is_pinned).map(comment => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                  {comments.filter(c => !c.is_pinned).map(comment => (
                    <CommentItem key={comment.id} comment={comment} />
                  ))}
                </>
              )}
              <div ref={chatEndRef} />
            </ScrollArea>

            <div className="p-4 border-t border-gray-800">
              {replyingTo && (
                <div className="mb-2 p-2 bg-gray-800 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    Replying to {replyingTo.user.full_name}
                  </span>
                  <button
                    onClick={() => setReplyingTo(null)}
                    className="text-gray-400 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              {!commentsEnabled ? (
                <div className="text-center py-2">
                  <MessageCircleOff className="h-6 w-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-xs text-gray-500">Comments are disabled</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Ask a question..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                    className="bg-gray-800 border-gray-700 text-white"
                  />
                  <Button
                    onClick={sendComment}
                    disabled={!newComment.trim()}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {!showChat && (
          <Button
            onClick={() => setShowChat(true)}
            className="fixed right-4 top-20 bg-amber-600 hover:bg-amber-700 rounded-full w-12 h-12"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-4 py-4 z-30">
        <div className="flex items-center justify-center gap-3 max-w-4xl mx-auto">
            {isAdmin && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="lg"
                      variant={isMuted ? 'destructive' : 'ghost'}
                      onClick={toggleMute}
                      className="flex flex-col items-center gap-1 h-auto py-3 px-6 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-400"
                    >
                      {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                      <span className="text-sm font-semibold">Mute</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isMuted ? 'Unmute microphone' : 'Mute microphone'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="lg"
                      variant={isVideoOff ? 'destructive' : 'ghost'}
                      onClick={toggleVideo}
                      className="flex flex-col items-center gap-1 h-auto py-3 px-6 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-400"
                    >
                      {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                      <span className="text-sm font-semibold">Camera</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="lg"
                      variant={isScreenSharing ? 'default' : 'ghost'}
                      onClick={toggleScreenShare}
                      className="flex flex-col items-center gap-1 h-auto py-3 px-6 rounded-xl bg-gray-800 hover:bg-gray-700 text-amber-400"
                    >
                      <Monitor className="h-6 w-6" />
                      <span className="text-sm font-semibold">Share</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isScreenSharing ? 'Stop sharing' : 'Share screen'}
                  </TooltipContent>
                </Tooltip>
              </>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={handleLeave}
                  className="flex flex-col items-center gap-1 h-auto py-3 px-6 rounded-xl bg-red-600 hover:bg-red-700"
                >
                  <PhoneOff className="h-6 w-6" />
                  <span className="text-sm font-semibold">End Call</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave the call</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default VideoCallRoom;
