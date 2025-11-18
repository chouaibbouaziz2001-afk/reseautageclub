"use client";

import { useEffect, useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { StorageAvatar } from '@/components/storage-avatar';

interface CallRequestDialogProps {
  open: boolean;
  type: 'incoming' | 'outgoing';
  callType: 'video' | 'voice';
  userName: string;
  userAvatar: string | null;
  onAccept?: () => void;
  onReject?: () => void;
  onCancel?: () => void;
  timeRemaining?: number;
}

export function CallRequestDialog({
  open,
  type,
  callType,
  userName,
  userAvatar,
  onAccept,
  onReject,
  onCancel,
  timeRemaining = 30
}: CallRequestDialogProps) {
  const isIncoming = type === 'incoming';
  const Icon = callType === 'video' ? Video : Phone;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="bg-gray-900 border-gray-800">
        <AlertDialogHeader>
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <StorageAvatar
                src={userAvatar}
                alt={userName}
                className="h-24 w-24"
              />
              <div className="absolute -bottom-2 -right-2 bg-amber-500 rounded-full p-3">
                <Icon className="h-6 w-6 text-gray-900" />
              </div>
            </div>

            <AlertDialogTitle className="text-2xl text-gray-100 text-center">
              {isIncoming ? (
                <>
                  <span className="capitalize">{userName}</span> is calling...
                </>
              ) : (
                <>Calling <span className="capitalize">{userName}</span>...</>
              )}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-gray-400 text-center">
              {isIncoming ? (
                <>Incoming {callType} call</>
              ) : (
                <>Waiting for response...</>
              )}
            </AlertDialogDescription>

            {timeRemaining > 0 && (
              <div className="text-gray-500 text-sm">
                {timeRemaining}s
              </div>
            )}
          </div>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-row justify-center space-x-4">
          {isIncoming ? (
            <>
              <AlertDialogCancel
                onClick={onReject}
                className="bg-red-600 hover:bg-red-700 text-white border-0"
              >
                <PhoneOff className="h-5 w-5 mr-2" />
                Decline
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={onAccept}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Icon className="h-5 w-5 mr-2" />
                Accept
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogCancel
              onClick={onCancel}
              className="bg-red-600 hover:bg-red-700 text-white border-0"
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              Cancel
            </AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
