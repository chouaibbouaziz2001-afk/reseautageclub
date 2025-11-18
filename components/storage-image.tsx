"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { resolveStorageUrl } from '@/lib/storage';
import { useMediaViewer } from '@/lib/media-viewer-context';

interface StorageImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallback?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  clickable?: boolean;
}

export function StorageImage({ src, alt, className, fallback, fill = false, width, height, clickable = true }: StorageImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
        setResolvedUrl(fallback || '');
        setLoading(false);
        return;
      }

      // Check if it's a blob URL (optimistic local preview)
      if (src.startsWith('blob:')) {
        if (mounted) {
          setResolvedUrl(src);
          setLoading(false);
        }
        return;
      }

      try {
        const url = await resolveStorageUrl(src);
        if (mounted) {
          setResolvedUrl(url);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving storage URL:', err);
        if (mounted) {
          setError(true);
          setResolvedUrl(fallback || '');
          setLoading(false);
        }
      }
    }

    resolve();

    return () => {
      mounted = false;
    };
  }, [src, fallback]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-800 animate-pulse`} />
    );
  }

  if (error || !resolvedUrl) {
    return fallback ? (
      fill ? (
        <Image src={fallback} alt={alt} fill className={className} />
      ) : (
        <Image src={fallback} alt={alt} width={width || 500} height={height || 500} className={className} />
      )
    ) : (
      <div className={`${className} bg-gray-800 flex items-center justify-center text-gray-500`}>
        No image
      </div>
    );
  }

  const imageElement = fill ? (
    <Image
      src={resolvedUrl}
      alt={alt}
      fill
      className={className}
      onError={() => {
        setError(true);
        setResolvedUrl(fallback || '');
      }}
    />
  ) : (
    <Image
      src={resolvedUrl}
      alt={alt}
      width={width || 500}
      height={height || 500}
      className={className}
      onError={() => {
        setError(true);
        setResolvedUrl(fallback || '');
      }}
    />
  );

  if (clickable) {
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
        {imageElement}
      </div>
    );
  }

  return imageElement;
}
