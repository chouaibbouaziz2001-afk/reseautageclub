/**
 * Encrypted WebRTC Signaling Helpers
 * Encrypts SDP offers/answers and ICE candidates before storing in database
 */

import { supabase } from './supabase';
import { encryptSignalingData, decryptSignalingData } from './webrtc-encryption';

export type SignalType = 'offer' | 'answer' | 'ice_candidate';

export interface RTCSignalData {
  type?: string;
  sdp?: string;
  candidate?: string;
  [key: string]: unknown;
}

export interface SignalingData {
  id: string;
  call_id: string;
  user_id: string;
  signal_type: SignalType;
  signal_data: RTCSignalData; // Decrypted data
  created_at: string;
}

/**
 * Stores encrypted signaling data in the database
 */
export async function storeEncryptedSignal(
  callId: string,
  userId: string,
  signalType: SignalType,
  signalData: RTCSignalData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Encrypt the signal data before storing
    const encryptedData = encryptSignalingData(JSON.stringify(signalData));

    const { error } = await supabase
      .from('call_signaling')
      .insert({
        call_id: callId,
        user_id: userId,
        signal_type: signalType,
        signal_data: { encrypted: encryptedData }, // Store as encrypted field
      });

    if (error) {
      console.error('[EncryptedSignaling] Error storing signal:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('[EncryptedSignaling] Exception storing signal:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Retrieves and decrypts signaling data from the database
 */
export async function getEncryptedSignals(
  callId: string
): Promise<{ data: SignalingData[] | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('call_signaling')
      .select('*')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[EncryptedSignaling] Error fetching signals:', error);
      return { data: null, error: error.message };
    }

    // Decrypt each signal
    const decryptedSignals: SignalingData[] = [];

    for (const signal of data || []) {
      try {
        const encrypted = signal.signal_data?.encrypted;

        if (encrypted) {
          const decryptedData = decryptSignalingData(encrypted);
          decryptedSignals.push({
            ...signal,
            signal_data: JSON.parse(decryptedData),
          });
        } else {
          // Handle unencrypted legacy data
          decryptedSignals.push(signal as SignalingData);
        }
      } catch (decryptError) {
        console.error('[EncryptedSignaling] Error decrypting signal:', decryptError);
        // Skip signals that can't be decrypted
        continue;
      }
    }

    return { data: decryptedSignals };
  } catch (error) {
    console.error('[EncryptedSignaling] Exception fetching signals:', error);
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Subscribes to encrypted signaling data with real-time updates
 */
export function subscribeToEncryptedSignals(
  callId: string,
  onSignal: (signal: SignalingData) => void
) {
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
      (payload) => {
        try {
          const signal = payload.new as {
            id: string;
            call_id: string;
            user_id: string;
            signal_type: SignalType;
            signal_data?: { encrypted?: string } | RTCSignalData;
            created_at: string;
          };
          const encrypted = 'encrypted' in (signal.signal_data || {}) 
            ? (signal.signal_data as { encrypted?: string }).encrypted 
            : undefined;

          if (encrypted) {
            const decryptedData = decryptSignalingData(encrypted);
            onSignal({
              ...signal,
              signal_data: JSON.parse(decryptedData),
            });
          } else {
            // Handle unencrypted legacy data
            onSignal(signal as SignalingData);
          }
        } catch (error) {
          console.error('[EncryptedSignaling] Error decrypting real-time signal:', error);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
