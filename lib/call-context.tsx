'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';
import { encryptSignalingData, decryptSignalingData } from './webrtc-encryption';

interface CallRequest {
  id: string;
  caller_id: string;
  receiver_id: string;
  call_type: 'video' | 'audio';
  status: 'pending' | 'accepted' | 'declined' | 'missed' | 'cancelled';
  room_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  answered_at: string | null;
  caller?: {
    full_name: string;
    avatar_url: string | null;
  };
  receiver?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface CallContextType {
  incomingCall: CallRequest | null;
  outgoingCall: CallRequest | null;
  activeCall: CallRequest | null;
  initiateCall: (receiverId: string, callType: 'video' | 'audio') => Promise<CallRequest | null>;
  acceptCall: (callId: string) => Promise<boolean>;
  declineCall: (callId: string) => Promise<boolean>;
  cancelCall: (callId: string) => Promise<boolean>;
  endCall: () => void;
  clearIncomingCall: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<CallRequest | null>(null);
  const [outgoingCall, setOutgoingCall] = useState<CallRequest | null>(null);
  const [activeCall, setActiveCall] = useState<CallRequest | null>(null);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!user?.id) return;

    console.log('[CallContext] Setting up realtime subscription for user:', user.id);

    // Subscribe to call_requests where user is the receiver
    const channel = supabase
      .channel('incoming_calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log('[CallContext] New incoming call:', payload);

          const callRequest = payload.new as CallRequest;

          if (callRequest.status === 'pending') {
            // Fetch caller profile info
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', callRequest.caller_id)
              .single();

            const enrichedCall: CallRequest = {
              ...callRequest,
              caller: callerProfile || undefined,
            };

            console.log('[CallContext] Setting incoming call with caller info:', enrichedCall);
            setIncomingCall(enrichedCall);

            // Play notification sound
            try {
              const audio = new Audio('/notification-sound.mp3');
              audio.play().catch(e => console.log('[CallContext] Could not play sound:', e));
            } catch (e) {
              console.log('[CallContext] Audio notification error:', e);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[CallContext] Call request updated:', payload);
          const updatedCall = payload.new as CallRequest;

          // Clear incoming call if it's no longer pending
          if (updatedCall.status !== 'pending') {
            setIncomingCall(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_requests',
          filter: `caller_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[CallContext] Outgoing call updated:', payload);
          const updatedCall = payload.new as CallRequest;

          // Handle status changes for any outgoing call
          if (updatedCall.status === 'accepted') {
            console.log('[CallContext] Call accepted!');
            setActiveCall(updatedCall);
            setOutgoingCall(null);
          } else if (updatedCall.status === 'declined') {
            console.log('[CallContext] Call declined');
            setOutgoingCall((current) => {
              if (current && current.id === updatedCall.id) {
                alert('Call was declined');
                return null;
              }
              return current;
            });
          } else if (updatedCall.status === 'missed') {
            console.log('[CallContext] Call missed (no answer)');
            setOutgoingCall((current) => {
              if (current && current.id === updatedCall.id) {
                alert('No answer');
                return null;
              }
              return current;
            });
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[CallContext] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Auto-timeout check for outgoing calls
  useEffect(() => {
    if (!outgoingCall) return;

    const expiresAt = new Date(outgoingCall.expires_at).getTime();
    const now = Date.now();
    const timeout = expiresAt - now;

    if (timeout <= 0) {
      // Already expired
      setOutgoingCall(null);
      return;
    }

    const timer = setTimeout(() => {
      console.log('[CallContext] Outgoing call timed out');
      setOutgoingCall(null);
      alert('No answer - call timed out');
    }, timeout);

    return () => clearTimeout(timer);
  }, [outgoingCall]);

  const initiateCall = useCallback(async (receiverId: string, callType: 'video' | 'audio'): Promise<CallRequest | null> => {
    if (!user?.id) {
      console.error('[CallContext] No user logged in');
      return null;
    }

    console.log('[CallContext] Initiating call to:', receiverId, 'type:', callType);

    try {
      // Create call request
      const { data, error } = await supabase
        .from('call_requests')
        .insert({
          caller_id: user.id,
          receiver_id: receiverId,
          call_type: callType,
          status: 'pending',
          room_id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        })
        .select(`
          *,
          receiver:profiles!call_requests_receiver_id_fkey(full_name, avatar_url)
        `)
        .single();

      if (error) {
        console.error('[CallContext] Error creating call request:', error);
        return null;
      }

      console.log('[CallContext] Call request created:', data);
      setOutgoingCall(data as CallRequest);
      return data as CallRequest;
    } catch (error) {
      console.error('[CallContext] Failed to initiate call:', error);
      return null;
    }
  }, [user?.id]);

  const acceptCall = useCallback(async (callId: string): Promise<boolean> => {
    console.log('[CallContext] Accepting call:', callId);

    try {
      const { data, error } = await supabase
        .from('call_requests')
        .update({
          status: 'accepted',
          answered_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .select()
        .single();

      if (error) {
        console.error('[CallContext] Error accepting call:', error);
        return false;
      }

      console.log('[CallContext] Call accepted:', data);
      setActiveCall(data as CallRequest);
      setIncomingCall(null);
      return true;
    } catch (error) {
      console.error('[CallContext] Failed to accept call:', error);
      return false;
    }
  }, []);

  const declineCall = useCallback(async (callId: string): Promise<boolean> => {
    console.log('[CallContext] Declining call:', callId);

    try {
      const { error } = await supabase
        .from('call_requests')
        .update({
          status: 'declined',
          answered_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (error) {
        console.error('[CallContext] Error declining call:', error);
        return false;
      }

      console.log('[CallContext] Call declined');
      setIncomingCall(null);
      return true;
    } catch (error) {
      console.error('[CallContext] Failed to decline call:', error);
      return false;
    }
  }, []);

  const cancelCall = useCallback(async (callId: string): Promise<boolean> => {
    console.log('[CallContext] Cancelling call:', callId);

    try {
      const { error } = await supabase
        .from('call_requests')
        .update({
          status: 'cancelled',
        })
        .eq('id', callId);

      if (error) {
        console.error('[CallContext] Error cancelling call:', error);
        return false;
      }

      console.log('[CallContext] Call cancelled');
      setOutgoingCall(null);
      return true;
    } catch (error) {
      console.error('[CallContext] Failed to cancel call:', error);
      return false;
    }
  }, []);

  const endCall = useCallback(async () => {
    console.log('[CallContext] Ending active call');

    // Update call status in database to notify other user
    if (activeCall) {
      try {
        await supabase
          .from('call_requests')
          .update({ status: 'cancelled' })
          .eq('id', activeCall.id);
      } catch (error) {
        console.error('[CallContext] Error updating call status:', error);
      }
    }

    setActiveCall(null);
    setOutgoingCall(null);
    setIncomingCall(null);
  }, [activeCall]);

  const clearIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        outgoingCall,
        activeCall,
        initiateCall,
        acceptCall,
        declineCall,
        cancelCall,
        endCall,
        clearIncomingCall,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
}
