'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCall } from '@/lib/call-context';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PhoneOff, Video, Phone } from 'lucide-react';

export function OutgoingCallDialog() {
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { outgoingCall, activeCall, cancelCall } = useCall();
  const [isVisible, setIsVisible] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Prevent SSR/hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (outgoingCall) {
      console.log('[OutgoingCall] Showing outgoing call dialog:', outgoingCall);
      setIsVisible(true);
      setElapsedTime(0);
    } else {
      setIsVisible(false);
    }
  }, [outgoingCall]);

  // Navigate to call room when call is accepted
  useEffect(() => {
    if (activeCall) {
      console.log('[OutgoingCall] Call accepted! Navigating to call room:', activeCall.id);
      // Small delay to ensure state is clean
      setTimeout(() => {
        router.push(`/call/${activeCall.id}`);
      }, 100);
    }
  }, [activeCall, router]);

  // Timer for elapsed time
  useEffect(() => {
    if (!outgoingCall) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [outgoingCall]);

  if (!mounted || !isVisible || !outgoingCall) {
    return null;
  }

  const handleCancel = async () => {
    console.log('[OutgoingCall] Cancelling call:', outgoingCall.id);
    await cancelCall(outgoingCall.id);
  };

  const receiverName = outgoingCall.receiver?.full_name || 'Unknown User';
  const receiverAvatar = outgoingCall.receiver?.avatar_url;
  const isVideoCall = outgoingCall.call_type === 'video';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

        {/* Receiver avatar and name */}
        <div className="flex flex-col items-center mb-8">
          <Avatar className="h-24 w-24 mb-4 ring-4 ring-yellow-600/30">
            <AvatarImage src={receiverAvatar || undefined} alt={receiverName} />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-yellow-600 to-yellow-700 text-white">
              {receiverName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <h2 className="text-2xl font-bold text-white mb-2">
            Calling {receiverName}...
          </h2>

          <p className="text-gray-400 text-lg mb-4">
            Waiting for response...
          </p>

          <div className="text-yellow-600 font-mono text-2xl">
            {formatTime(elapsedTime)}
          </div>
        </div>

        {/* Cancel button */}
        <div className="flex justify-center">
          <Button
            onClick={handleCancel}
            size="lg"
            className="bg-red-600 hover:bg-red-700 text-white rounded-full h-16 w-16 p-0 shadow-lg hover:shadow-red-600/50 transition-all"
          >
            <PhoneOff className="h-7 w-7" />
          </Button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Tap to cancel
          </p>
        </div>
      </div>
    </div>
  );
}
