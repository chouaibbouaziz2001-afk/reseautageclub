import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ICE servers configuration for WebRTC
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

interface UseWebRTCProps {
  callId: string;
  userId: string;
  isInitiator: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

export function useWebRTC({
  callId,
  userId,
  isInitiator,
  onRemoteStream,
  onError,
}: UseWebRTCProps) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Initialize media devices
  const initializeMedia = useCallback(async (isVideo: boolean = true) => {
    try {
      console.log('[WebRTC] Requesting user media...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideo ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log('[WebRTC] Got local stream:', stream.id);
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error('[WebRTC] Error accessing media devices:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [onError]);

  // Create peer connection
  const createPeerConnection = useCallback(() => {
    console.log('[WebRTC] Creating peer connection...');
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Handle ICE candidates
    pc.onicecandidate = async (event) => {
      if (event.candidate) {
        console.log('[WebRTC] New ICE candidate:', event.candidate);
        try {
          await supabase.from('call_signaling').insert({
            call_id: callId,
            user_id: userId,
            signal_type: 'ice_candidate',
            signal_data: event.candidate.toJSON(),
          });
        } catch (error) {
          console.error('[WebRTC] Error sending ICE candidate:', error);
        }
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
      setIsConnected(pc.connectionState === 'connected');

      if (pc.connectionState === 'failed') {
        console.error('[WebRTC] Connection failed');
        onError?.(new Error('Connection failed'));
      }
    };

    // Handle ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      const stream = event.streams[0];
      if (stream) {
        console.log('[WebRTC] Setting remote stream:', stream.id);
        setRemoteStream(stream);
        onRemoteStream?.(stream);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }, [callId, userId, onRemoteStream, onError]);

  // Add local stream to peer connection
  const addLocalStreamToPeer = useCallback((stream: MediaStream, pc: RTCPeerConnection) => {
    console.log('[WebRTC] Adding local stream to peer connection');
    stream.getTracks().forEach((track) => {
      console.log('[WebRTC] Adding track:', track.kind, track.id);
      pc.addTrack(track, stream);
    });
  }, []);

  // Create and send offer
  const createOffer = useCallback(async (pc: RTCPeerConnection) => {
    try {
      console.log('[WebRTC] Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log('[WebRTC] Sending offer to database');
      await supabase.from('call_signaling').insert({
        call_id: callId,
        user_id: userId,
        signal_type: 'offer',
        signal_data: offer,
      });
    } catch (error) {
      console.error('[WebRTC] Error creating offer:', error);
      onError?.(error as Error);
    }
  }, [callId, userId, onError]);

  // Handle received offer
  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, pc: RTCPeerConnection) => {
    try {
      console.log('[WebRTC] Received offer, creating answer...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Add any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        console.log('[WebRTC] Adding pending ICE candidate');
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('[WebRTC] Sending answer to database');
      await supabase.from('call_signaling').insert({
        call_id: callId,
        user_id: userId,
        signal_type: 'answer',
        signal_data: answer,
      });
    } catch (error) {
      console.error('[WebRTC] Error handling offer:', error);
      onError?.(error as Error);
    }
  }, [callId, userId, onError]);

  // Handle received answer
  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit, pc: RTCPeerConnection) => {
    try {
      console.log('[WebRTC] Received answer, setting remote description...');
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      // Add any pending ICE candidates
      for (const candidate of pendingCandidatesRef.current) {
        console.log('[WebRTC] Adding pending ICE candidate');
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current = [];
    } catch (error) {
      console.error('[WebRTC] Error handling answer:', error);
      onError?.(error as Error);
    }
  }, [onError]);

  // Handle received ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit, pc: RTCPeerConnection) => {
    try {
      if (pc.remoteDescription) {
        console.log('[WebRTC] Adding ICE candidate');
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        console.log('[WebRTC] Queuing ICE candidate (no remote description yet)');
        pendingCandidatesRef.current.push(candidate);
      }
    } catch (error) {
      console.error('[WebRTC] Error adding ICE candidate:', error);
    }
  }, []);

  // Setup signaling channel
  const setupSignaling = useCallback((pc: RTCPeerConnection) => {
    console.log('[WebRTC] Setting up signaling channel...');

    const channel = supabase
      .channel(`call-signaling-${callId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_signaling',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const signal = payload.new as any;

          // Ignore own signals
          if (signal.user_id === userId) {
            return;
          }

          console.log('[WebRTC] Received signal:', signal.signal_type);

          switch (signal.signal_type) {
            case 'offer':
              await handleOffer(signal.signal_data, pc);
              break;
            case 'answer':
              await handleAnswer(signal.signal_data, pc);
              break;
            case 'ice_candidate':
              await handleIceCandidate(signal.signal_data, pc);
              break;
          }
        }
      )
      .subscribe();

    signalingChannelRef.current = channel;
  }, [callId, userId, handleOffer, handleAnswer, handleIceCandidate]);

  // Initialize WebRTC connection
  const initializeConnection = useCallback(async (isVideo: boolean = true) => {
    try {
      console.log('[WebRTC] Initializing connection...');

      // Get local media
      const stream = await initializeMedia(isVideo);

      // Create peer connection
      const pc = createPeerConnection();

      // Add local stream
      addLocalStreamToPeer(stream, pc);

      // Setup signaling
      setupSignaling(pc);

      // If initiator, create and send offer
      if (isInitiator) {
        console.log('[WebRTC] Initiator: creating offer');
        await createOffer(pc);
      }

      return { stream, pc };
    } catch (error) {
      console.error('[WebRTC] Error initializing connection:', error);
      onError?.(error as Error);
      throw error;
    }
  }, [isInitiator, initializeMedia, createPeerConnection, addLocalStreamToPeer, setupSignaling, createOffer, onError]);

  // Toggle audio
  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }, [localStream]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('[WebRTC] Cleaning up...');

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        track.stop();
        console.log('[WebRTC] Stopped track:', track.kind);
      });
    }

    // Stop remote stream
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close peer connection and remove event listeners
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Unsubscribe from signaling
    if (signalingChannelRef.current) {
      supabase.removeChannel(signalingChannelRef.current);
      signalingChannelRef.current = null;
    }

    // Clear pending candidates
    pendingCandidatesRef.current = [];

    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
    setConnectionState('closed');
  }, [localStream, remoteStream]);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    localStream,
    remoteStream,
    isConnected,
    connectionState,
    initializeConnection,
    toggleAudio,
    toggleVideo,
    cleanup,
  };
}
