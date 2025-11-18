"use client";

import dynamic from 'next/dynamic';
import { GenericSkeleton } from '@/components/skeleton-loaders';

export const LazyPostComposer = dynamic(
  () => import('@/components/post-composer').then(mod => ({ default: mod.PostComposer })),
  {
    loading: () => (
      <div className="animate-pulse bg-gray-900/50 border-gray-800 rounded-lg p-4">
        <div className="h-24 bg-gray-800 rounded" />
      </div>
    ),
    ssr: false,
  }
);

export const LazyPostCard = dynamic(
  () => import('@/components/post-card').then(mod => ({ default: mod.PostCard })),
  {
    loading: () => (
      <div className="animate-pulse bg-gray-900/50 border-gray-800 rounded-lg p-4">
        <div className="flex gap-3 mb-3">
          <div className="h-12 w-12 bg-gray-800 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-800 rounded w-1/4" />
            <div className="h-3 bg-gray-800 rounded w-1/6" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-800 rounded w-full" />
          <div className="h-4 bg-gray-800 rounded w-5/6" />
        </div>
      </div>
    ),
    ssr: false,
  }
);

export const LazyVideoCallRoom = dynamic(
  () => import('@/components/video-call-room').then(mod => ({ default: mod.VideoCallRoom })),
  {
    loading: () => (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="animate-pulse text-white text-lg">Connecting...</div>
      </div>
    ),
    ssr: false,
  }
);

export const LazyCommentSection = dynamic(
  () => import('@/components/comment-section').then(mod => ({ default: mod.CommentSection })),
  {
    loading: () => (
      <div className="animate-pulse space-y-3 p-4">
        <div className="h-4 bg-gray-800 rounded w-1/3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 bg-gray-800 rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-gray-800 rounded w-1/4 mb-2" />
                <div className="h-3 bg-gray-800 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    ssr: false,
  }
);

export const LazyAudioRecorder = dynamic(
  () => import('@/components/audio-recorder').then(mod => ({ default: mod.AudioRecorder })),
  {
    loading: () => <div className="h-10 w-10 bg-gray-800 rounded animate-pulse" />,
    ssr: false,
  }
);
