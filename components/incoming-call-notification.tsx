'use client';

import { useEffect, useState } from 'react';
import { useCall } from '@/lib/call-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function IncomingCallNotification() {
  const [mounted, setMounted] = useState(false);
  const { incomingCall, acceptCall, declineCall } = useCall();
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  // Prevent SSR/hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (incomingCall) {
      console.log('[IncomingCall] Showing incoming call notification:', incomingCall);
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [incomingCall]);

  if (!mounted || !isVisible || !incomingCall) {
    return null;
  }

  const handleAccept = async () => {
    console.log('[IncomingCall] Accepting call:', incomingCall.id);
    const success = await acceptCall(incomingCall.id);

    if (success) {
      // Navigate to call room
      router.push(`/call/${incomingCall.id}`);
    }
  };

  const handleDecline = async () => {
    console.log('[IncomingCall] Declining call:', incomingCall.id);
    await declineCall(incomingCall.id);
  };

  const callerName = incomingCall.caller?.full_name || 'Unknown User';
  const callerAvatar = incomingCall.caller?.avatar_url;
  const isVideoCall = incomingCall.call_type === 'video';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-slate-700">
        {/* Call type indicator */}
        <div className="flex justify-center mb-6">
          <div className="bg-yellow-600 p-4 rounded-full animate-pulse">
            {isVideoCall ? (
              <Video className="h-8 w-8 text-white" />
            ) : (
              <Phone className="h-8 w-8 text-white" />
            )}
          </div>
        </div>

        {/* Caller avatar and name */}
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-24 w-24 mb-4 ring-4 ring-yellow-600/30">
            <AvatarImage src={callerAvatar || undefined} alt={callerName} />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-yellow-600 to-yellow-700 text-white">
              {callerName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-2xl font-bold text-white mb-2">
            {callerName}
          </h2>

          <p className="text-gray-400 text-lg">
            Incoming {isVideoCall ? 'video' : 'audio'} call...
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-4 justify-center">
          {/* Decline button */}
          <Button
            onClick={handleDecline}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white rounded-full h-16 w-16 p-0 shadow-lg hover:shadow-red-600/50 transition-all"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>

          {/* Accept button */}
          <Button
            onClick={handleAccept}
            size="lg"
            className="bg-green-600 hover:bg-green-700 text-white rounded-full h-16 w-16 p-0 shadow-lg hover:shadow-green-600/50 transition-all animate-pulse"
          >
            {isVideoCall ? (
              <Video className="h-7 w-7" />
            ) : (
              <Phone className="h-7 w-7" />
            )}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Swipe or tap to answer
          </p>
        </div>
      </div>
    </div>
  );
}
