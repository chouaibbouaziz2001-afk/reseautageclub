'use client';

import { useMediaViewer, MediaItem } from '@/lib/media-viewer-context';
import { cn } from '@/lib/utils';

interface ClickableImageProps {
  src: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
  additionalImages?: MediaItem[];
}

export function ClickableImage({ src, alt, className, children, additionalImages = [] }: ClickableImageProps) {
  const { openViewer } = useMediaViewer();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const items: MediaItem[] = [
      { type: 'image', src, alt },
      ...additionalImages,
    ];

    openViewer(items, 0);
  };

  return (
    <div
      onClick={handleClick}
      className={cn('cursor-pointer transition-opacity hover:opacity-90', className)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
    >
      {children}
    </div>
  );
}

interface ClickableVideoProps {
  src: string;
  poster?: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
}

export function ClickableVideo({ src, poster, alt, className, children }: ClickableVideoProps) {
  const { openViewer } = useMediaViewer();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    openViewer([{ type: 'video', src, poster, alt }], 0);
  };

  return (
    <div
      onClick={handleClick}
      className={cn('cursor-pointer transition-opacity hover:opacity-90', className)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick(e as any);
        }
      }}
    >
      {children}
    </div>
  );
}
