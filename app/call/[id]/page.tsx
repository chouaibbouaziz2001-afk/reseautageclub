'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWebRTC } from '@/hooks/use-webrtc';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, Loader2 } from 'lucide-react';

interface CallData {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'audio';
  status: string;
  room_id: string | null;
  caller: {
    full_name: string;
    avatar_url: string | null;
  };
  receiver: {
    full_name: string;
    avatar_url: string | null;
  };
}

export default function CallRoom() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const callId = params.id as string;

  const [callData, setCallData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTime = useRef<Date>(new Date());

  // Determine if current user is the initiator
  const isInitiator = callData ? callData.caller_id === user?.id : false;
  const otherUser = callData
    ? callData.caller_id === user?.id
      ? callData.receiver
      : callData.caller
    : null;

  // Initialize WebRTC
  const {
    localStream,
    remoteStream,
    isConnected,
    connectionState,
    initializeConnection,
    toggleAudio,
    toggleVideo,
    cleanup,
  } = useWebRTC({
    callId,
    userId: user?.id || '',
    isInitiator,
    onRemoteStream: (stream) => {
      console.log('[CallRoom] Remote stream received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    },
    onError: (err) => {
      console.error('[CallRoom] WebRTC error:', err);
      setError(err.message);
    },
  });

  // Fetch call data
  useEffect(() => {
    if (!callId || !user) return;

    const fetchCallData = async () => {
      try {
        const { data, error } = await supabase
          .from('call_requests')
          .select(`
            *,
            caller:profiles!call_requests_caller_id_fkey(full_name, avatar_url),
            receiver:profiles!call_requests_receiver_id_fkey(full_name, avatar_url)
          `)
          .eq('id', callId)
          .single();

        if (error) {
          console.error('[CallRoom] Error fetching call data:', error);
          setError('Failed to load call data');
          return;
        }

        if (data.status !== 'accepted') {
          console.log('[CallRoom] Call not accepted, redirecting');
          router.push('/messages');
          return;
        }

        // Ensure user is part of this call
        if (data.caller_id !== user.id && data.receiver_id !== user.id) {
          console.error('[CallRoom] User not part of this call');
          router.push('/messages');
          return;
        }

        setCallData(data as CallData);
        setLoading(false);
      } catch (err) {
        console.error('[CallRoom] Error:', err);
        setError('Failed to load call');
        setLoading(false);
      }
    };

    fetchCallData();
  }, [callId, user, router]);

  // Initialize WebRTC when call data is ready
  useEffect(() => {
    if (!callData || !user) return;

    const init = async () => {
      try {
        const isVideo = callData.call_type === 'video';
        await initializeConnection(isVideo);
        callStartTime.current = new Date();
      } catch (err) {
        console.error('[CallRoom] Failed to initialize connection:', err);
      }
    };

    init();

    return () => {
      cleanup();
    };
  }, [callData, user, initializeConnection, cleanup]);

  // Subscribe to call status changes
  useEffect(() => {
    if (!callId) return;

    const channel = supabase
      .channel(`call-status-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          if (updated.status === 'cancelled' || updated.status === 'declined') {
            console.log('[CallRoom] Call ended by other user');
            handleEndCall();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  // Update local video element
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Call duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    toggleAudio(!isMuted);
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    toggleVideo(!isVideoOn);
    setIsVideoOn(!isVideoOn);
  };

  const handleEndCall = async () => {
    try {
      // Update call status in database
      await supabase
        .from('call_requests')
        .update({ status: 'cancelled' })
        .eq('id', callId);

      // Cleanup WebRTC
      cleanup();

      // Navigate back
      router.push('/messages');
    } catch (err) {
      console.error('[CallRoom] Error ending call:', err);
      router.push('/messages');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-amber-500 mx-auto" />
          <p className="text-white text-lg">Loading call...</p>
        </div>
      </div>
    );
  }

  if (error || !callData) {
    return (
      <div className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-500 text-lg">{error || 'Call not found'}</p>
          <Button onClick={() => router.push('/messages')}>
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  const isVideoCall = callData.call_type === 'video';

  return (
    <div className="fixed inset-0 bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={otherUser?.avatar_url || undefined} alt={otherUser?.full_name} />
            <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white text-sm">
              {otherUser?.full_name?.substring(0, 2).toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-white font-semibold text-base truncate">
              {otherUser?.full_name || 'Unknown User'}
            </h2>
            <p className="text-gray-400 text-xs">
              {isConnected ? formatDuration(callDuration) : 'Connecting...'}
            </p>
          </div>
        </div>
        {!isConnected && (
          <div className="flex items-center space-x-2">
            <div className="h-2 w-2 bg-yellow-500 rounded-full animate-pulse" />
            <span className="text-yellow-500 text-sm">{connectionState}</span>
          </div>
        )}
      </div>

      {/* Video/Audio Area */}
      <div className="flex-1 relative overflow-hidden">
        {isVideoCall ? (
          <>
            {/* Remote Video (large, fills screen) */}
            <div className="absolute inset-0 bg-gray-900">
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <Avatar className="h-32 w-32 mx-auto mb-4">
                      <AvatarImage src={otherUser?.avatar_url || undefined} alt={otherUser?.full_name} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white text-4xl">
                        {otherUser?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-white text-xl">{otherUser?.full_name}</p>
                    <p className="text-gray-400 mt-2">Waiting for video...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Local Video (small, picture-in-picture) */}
            <div className="absolute top-4 right-4 w-32 sm:w-40 md:w-48 aspect-video bg-gray-800 rounded-lg overflow-hidden border-2 border-gray-700 shadow-lg z-10">
              {localStream && isVideoOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.avatarUrl || undefined} alt="You" />
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                      {user?.fullName?.substring(0, 2).toUpperCase() || 'Y'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Audio Call UI */
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-900 to-black">
            <div className="text-center">
              <Avatar className="h-40 w-40 mx-auto mb-6 ring-4 ring-amber-500/30">
                <AvatarImage src={otherUser?.avatar_url || undefined} alt={otherUser?.full_name} />
                <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-600 text-white text-5xl">
                  {otherUser?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <p className="text-white text-3xl font-semibold mb-2">{otherUser?.full_name}</p>
              <p className="text-gray-400 text-lg mb-6">
                {isConnected ? 'Audio call in progress' : 'Connecting...'}
              </p>
              <p className="text-amber-500 text-4xl font-mono">{formatDuration(callDuration)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 px-4 py-4 sm:py-6">
        <div className="flex items-center justify-center space-x-4 sm:space-x-6 max-w-md mx-auto">
          {/* Mute button */}
          <Button
            onClick={handleToggleMute}
            size="lg"
            className={`rounded-full h-14 w-14 sm:h-16 sm:w-16 ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          {/* End call button */}
          <Button
            onClick={handleEndCall}
            size="lg"
            className="bg-red-600 hover:bg-red-700 rounded-full h-16 w-16 sm:h-20 sm:w-20"
          >
            <PhoneOff className="h-7 w-7 sm:h-8 sm:w-8" />
          </Button>

          {/* Video toggle button (only for video calls) */}
          {isVideoCall && (
            <Button
              onClick={handleToggleVideo}
              size="lg"
              className={`rounded-full h-14 w-14 sm:h-16 sm:w-16 ${
                !isVideoOn
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {isVideoOn ? (
                <VideoIcon className="h-6 w-6" />
              ) : (
                <VideoOff className="h-6 w-6" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
