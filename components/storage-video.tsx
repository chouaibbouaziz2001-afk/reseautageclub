"use client";

import { useState, useEffect } from 'react';
import { resolveStorageUrl } from '@/lib/storage';
import { useMediaViewer } from '@/lib/media-viewer-context';
import { Maximize2 } from 'lucide-react';

interface StorageVideoProps {
  src?: string | null | undefined;
  url?: string | null | undefined;
  className?: string;
  controls?: boolean;
  onEnded?: () => void;
  muted?: boolean;
  autoPlay?: boolean;
  clickable?: boolean;
}

export function StorageVideo({ src, url, className, controls = true, onEnded, muted = false, autoPlay = false, clickable = true }: StorageVideoProps) {
  const videoUrl = url || src;
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { openViewer } = useMediaViewer();

  const handleFullscreen = (e: React.MouseEvent) => {
    if (!clickable || !resolvedUrl) return;
    e.preventDefault();
    e.stopPropagation();
    openViewer([{ type: 'video', src: resolvedUrl }], 0);
  };

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!videoUrl) {
        setLoading(false);
        return;
      }

      // Check if it's a blob URL (optimistic local preview)
      if (videoUrl.startsWith('blob:')) {
        if (mounted) {
          setResolvedUrl(videoUrl);
          setLoading(false);
        }
        return;
      }

      try {
        const resolvedUrl = await resolveStorageUrl(videoUrl);
        if (mounted) {
          setResolvedUrl(resolvedUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving storage URL:', err);
        if (mounted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    resolve();

    return () => {
      mounted = false;
    };
  }, [videoUrl]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-800 animate-pulse flex items-center justify-center`}>
        <p className="text-gray-500">Loading video...</p>
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className={`${className} bg-gray-800 flex items-center justify-center text-gray-500`}>
        Video unavailable
      </div>
    );
  }

  if (clickable) {
    return (
      <div className="relative group">
        <video
          src={resolvedUrl}
          className={className}
          controls={controls}
          controlsList="nodownload"
          onContextMenu={(e) => e.preventDefault()}
          onError={() => setError(true)}
          onEnded={onEnded}
          playsInline
          preload="metadata"
          muted={muted}
          autoPlay={autoPlay}
          crossOrigin="anonymous"
        />
        <button
          onClick={handleFullscreen}
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="Open in fullscreen viewer"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      </div>
    );
  }

  return (
    <video
      src={resolvedUrl}
      className={className}
      controls={controls}
      controlsList="nodownload"
      onContextMenu={(e) => e.preventDefault()}
      onError={() => setError(true)}
      onEnded={onEnded}
      playsInline
      preload="metadata"
      muted={muted}
      autoPlay={autoPlay}
      crossOrigin="anonymous"
    />
  );
}
