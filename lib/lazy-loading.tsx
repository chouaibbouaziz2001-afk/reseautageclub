/**
 * Lazy Loading Components
 * Dynamic imports with loading states
 */

import { lazy, ComponentType, Suspense, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LazyOptions {
  fallback?: ReactNode;
  delay?: number;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
  </div>
);

/**
 * Create lazy loaded component with loading state
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyOptions = {}
): ComponentType<React.ComponentProps<T>> {
  const { fallback = <DefaultFallback />, delay = 0 } = options;
  
  const LazyComponent = lazy(async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return importFn();
  });

  function LazyComponentWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }
  
  // Set display name for React DevTools
  LazyComponentWrapper.displayName = 'LazyComponentWrapper';

  return LazyComponentWrapper;
}

/**
 * Pre-made lazy loaded heavy components
 */

// Video Call Room
export const LazyVideoCallRoom = createLazyComponent(
  () => import('@/components/video-call-room'),
  { fallback: <div className="flex items-center justify-center p-8">Loading video call...</div> }
);

// Post Composer
export const LazyPostComposer = createLazyComponent(
  () => import('@/components/post-composer'),
  { fallback: <div className="p-4">Loading composer...</div> }
);

// Media Viewer
export const LazyMediaViewer = createLazyComponent(
  () => import('@/components/media-viewer')
);

// Comment Section
export const LazyCommentSection = createLazyComponent(
  () => import('@/components/comment-section')
);

// Community Chat
export const LazyCommunityChat = createLazyComponent(
  () => import('@/components/community-chat')
);

// Audio Recorder
export const LazyAudioRecorder = createLazyComponent(
  () => import('@/components/audio-recorder')
);
