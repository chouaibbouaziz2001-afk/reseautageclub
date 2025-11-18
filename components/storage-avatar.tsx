"use client";

import { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { resolveStorageUrl } from '@/lib/storage';
import { useMediaViewer } from '@/lib/media-viewer-context';

interface StorageAvatarProps {
  src: string | null | undefined;
  alt?: string;
  fallback?: string;
  className?: string;
  clickable?: boolean;
}

export function StorageAvatar({ src, alt = 'Avatar', fallback, className, clickable = true }: StorageAvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { openViewer } = useMediaViewer();

  const handleClick = (e: React.MouseEvent) => {
    if (!clickable || !resolvedUrl) return;
    e.preventDefault();
    e.stopPropagation();
    openViewer([{ type: 'image', src: resolvedUrl, alt }], 0);
  };

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!src) {
        setLoading(false);
        return;
      }

      try {
        const url = await resolveStorageUrl(src);
        if (mounted) {
          setResolvedUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving avatar URL:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    }

    resolve();

    return () => {
      mounted = false;
    };
  }, [src]);

  const avatarElement = (
    <Avatar className={className}>
      {!loading && resolvedUrl && (
        <AvatarImage src={resolvedUrl} alt={alt} className="object-cover" />
      )}
      <AvatarFallback className="text-3xl bg-gradient-to-br from-amber-500 to-yellow-500 text-gray-900">
        {fallback}
      </AvatarFallback>
    </Avatar>
  );

  if (clickable && resolvedUrl) {
    return (
      <div
        onClick={handleClick}
        className="cursor-pointer transition-opacity hover:opacity-90"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(e as any);
          }
        }}
      >
        {avatarElement}
      </div>
    );
  }

  return avatarElement;
}
