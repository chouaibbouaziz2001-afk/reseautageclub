"use client";

import { useState, useEffect } from 'react';
import { resolveStorageUrl } from '@/lib/storage';

interface StorageAudioProps {
  src: string | null | undefined;
  className?: string;
  controls?: boolean;
}

export function StorageAudio({ src, className, controls = true }: StorageAudioProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    async function resolve() {
      if (!src) {
        if (mounted) {
          setLoading(false);
          setError(true);
          setErrorMessage('No audio source provided');
        }
        return;
      }

      // Check if it's a blob URL (optimistic local preview)
      if (src.startsWith('blob:')) {
        if (mounted) {
          setResolvedUrl(src);
          setLoading(false);
          setError(false);
        }
        return;
      }

      try {
        console.log('[StorageAudio] Resolving:', src);
        const url = await resolveStorageUrl(src);
        console.log('[StorageAudio] Resolved to:', url);

        if (!url) {
          throw new Error('Empty URL returned');
        }

        if (mounted) {
          setResolvedUrl(url);
          setLoading(false);
          setError(false);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[StorageAudio] Error:', errMsg, 'Source:', src);
        if (mounted) {
          setError(true);
          setErrorMessage(errMsg);
          setLoading(false);
        }
      }
    }

    resolve();

    return () => {
      mounted = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-2">
        <p className="text-gray-500 text-sm">Loading audio...</p>
      </div>
    );
  }

  if (error || !resolvedUrl) {
    return (
      <div className="flex items-center justify-center py-2">
        <p className="text-red-500 text-sm" title={errorMessage}>Audio unavailable</p>
      </div>
    );
  }

  return (
    <audio
      src={resolvedUrl}
      className={className}
      controls={controls}
      controlsList="nodownload noplaybackrate"
      style={{
        height: '48px',
        maxWidth: '100%',
        minWidth: '100%'
      }}
      onError={(e) => {
        console.error('[StorageAudio] Playback error:', e);
        setError(true);
        setErrorMessage('Failed to load audio');
      }}
    />
  );
}
