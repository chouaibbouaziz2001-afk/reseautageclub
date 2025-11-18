"use client";

import { useState, useRef, useEffect } from 'react';
import { StorageImage } from '@/components/storage-image';
import { StorageVideo } from '@/components/storage-video';
import { useMediaViewer, MediaItem } from '@/lib/media-viewer-context';
import { resolveStorageUrl } from '@/lib/storage';
import { Heart } from 'lucide-react';

interface PostMediaProps {
  images?: string[];
  videoUrl?: string;
  audioUrl?: string;
  onMediaClick?: () => void;
  onDoubleTap?: () => void;
}

export function PostMedia({ images = [], videoUrl, audioUrl, onMediaClick, onDoubleTap }: PostMediaProps) {
  const { openViewer } = useMediaViewer();
  const [showHeart, setShowHeart] = useState(false);
  const lastTapTimeRef = useRef<number>(0);
  const singleClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleImageClick = async (index: number) => {
    if (onMediaClick) onMediaClick();

    const mediaItems: MediaItem[] = await Promise.all(
      images.map(async (img) => ({
        type: 'image' as const,
        src: await resolveStorageUrl(img),
        alt: 'Post image',
      }))
    );
    openViewer(mediaItems, index);
  };

  const triggerLikeAnimation = () => {
    console.log('[PostMedia] Triggering like animation, onDoubleTap exists:', !!onDoubleTap);

    setShowHeart(true);
    setTimeout(() => {
      setShowHeart(false);
    }, 1000);

    // Call the like handler AFTER starting animation
    if (onDoubleTap) {
      console.log('[PostMedia] Calling onDoubleTap handler');
      try {
        onDoubleTap();
      } catch (error) {
        console.error('[PostMedia] Error calling onDoubleTap:', error);
      }
    } else {
      console.warn('[PostMedia] No onDoubleTap handler provided');
    }
  };

  // Handle desktop double-click
  const handleDoubleClick = (event: React.MouseEvent) => {
    console.log('[PostMedia] Double click detected');
    event.preventDefault();
    event.stopPropagation();

    // Clear any pending single click
    if (singleClickTimeoutRef.current) {
      clearTimeout(singleClickTimeoutRef.current);
      singleClickTimeoutRef.current = null;
    }

    triggerLikeAnimation();
  };

  // Handle mobile double-tap
  const handleTouchEnd = (event: React.TouchEvent) => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
      // Double tap detected
      console.log('[PostMedia] Double tap detected');
      event.preventDefault();
      event.stopPropagation();

      // Clear any pending single tap
      if (singleClickTimeoutRef.current) {
        clearTimeout(singleClickTimeoutRef.current);
        singleClickTimeoutRef.current = null;
      }

      triggerLikeAnimation();
      lastTapTimeRef.current = 0;
    } else {
      // Single tap - record time
      lastTapTimeRef.current = now;
    }
  };

  // Handle single click (with delay to detect double-click)
  const handleSingleClick = (index: number, event: React.MouseEvent) => {
    // Don't use timeout delay on desktop - let native double-click handle it
    // Just open viewer directly on single click
    if (event.detail === 1) {
      // This is a single click (detail === 1)
      // Set a short timeout to see if a double-click follows
      if (singleClickTimeoutRef.current) {
        clearTimeout(singleClickTimeoutRef.current);
      }

      singleClickTimeoutRef.current = setTimeout(() => {
        handleImageClick(index);
        singleClickTimeoutRef.current = null;
      }, 250);
    }
  };

  const LikeHeartAnimation = () => (
    <div
      className={`absolute inset-0 flex items-center justify-center pointer-events-none z-20 transition-all duration-200 ${
        showHeart ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
      }`}
    >
      <div
        className={`transition-all ease-out ${
          showHeart ? 'duration-200 scale-100 opacity-100' : 'duration-500 scale-125 opacity-0'
        }`}
      >
        <Heart
          className="w-24 h-24 md:w-28 md:h-28 text-red-500 fill-red-500"
          style={{
            filter: 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.9)) drop-shadow(0 0 40px rgba(239, 68, 68, 0.6))',
          }}
        />
      </div>
    </div>
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (singleClickTimeoutRef.current) {
        clearTimeout(singleClickTimeoutRef.current);
      }
    };
  }, []);

  // Video display
  if (videoUrl) {
    return (
      <div className="my-3 w-full">
        <div className="relative w-full bg-black rounded-lg overflow-hidden">
          <StorageVideo
            src={videoUrl}
            className="w-full h-auto max-h-[600px] object-contain"
            controls
          />
        </div>
      </div>
    );
  }

  // No images to display
  if (images.length === 0) {
    return null;
  }

  // Single image - show larger with maintained aspect ratio
  if (images.length === 1) {
    return (
      <div className="my-3 w-full">
        <div
          className="relative w-full rounded-lg overflow-hidden bg-gray-900 cursor-pointer group select-none"
          onClick={(e) => handleSingleClick(0, e)}
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
        >
          <StorageImage
            src={images[0]}
            alt="Post image"
            className="w-full h-auto max-h-[600px] object-contain group-hover:opacity-95 transition-opacity"
            clickable={false}
          />
          <LikeHeartAnimation />
        </div>
      </div>
    );
  }

  // Two images - side by side with same height
  if (images.length === 2) {
    return (
      <div className="my-3 grid grid-cols-2 gap-2">
        {images.map((image, index) => (
          <div
            key={index}
            className="relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-900 group select-none"
            onClick={(e) => handleSingleClick(index, e)}
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
          >
            <StorageImage
              src={image}
              alt={`Post image ${index + 1}`}
              className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
              clickable={false}
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              {index + 1}/2
            </div>
            <LikeHeartAnimation />
          </div>
        ))}
      </div>
    );
  }

  // Three images - one large on left, two stacked on right
  if (images.length === 3) {
    return (
      <div className="my-3 grid grid-cols-2 gap-2 h-[400px]">
        <div
          className="relative row-span-2 cursor-pointer overflow-hidden rounded-lg bg-gray-900 group select-none"
          onClick={(e) => handleSingleClick(0, e)}
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
        >
          <StorageImage
            src={images[0]}
            alt="Post image 1"
            className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
            clickable={false}
          />
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
            1/3
          </div>
          <LikeHeartAnimation />
        </div>
        {images.slice(1, 3).map((image, index) => (
          <div
            key={index + 1}
            className="relative cursor-pointer overflow-hidden rounded-lg bg-gray-900 group select-none"
            onClick={(e) => handleSingleClick(index + 1, e)}
            onDoubleClick={handleDoubleClick}
            onTouchEnd={handleTouchEnd}
          >
            <StorageImage
              src={image}
              alt={`Post image ${index + 2}`}
              className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
              clickable={false}
            />
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              {index + 2}/3
            </div>
            <LikeHeartAnimation />
          </div>
        ))}
      </div>
    );
  }

  // Four or more images - 2x2 grid, show "+X more" on last image if > 4
  const displayImages = images.slice(0, 4);
  const remainingCount = images.length - 4;

  return (
    <div className="my-3 grid grid-cols-2 gap-2 h-[400px]">
      {displayImages.map((image, index) => (
        <div
          key={index}
          className="relative cursor-pointer overflow-hidden rounded-lg bg-gray-900 group select-none"
          onClick={(e) => handleSingleClick(index, e)}
          onDoubleClick={handleDoubleClick}
          onTouchEnd={handleTouchEnd}
        >
          <StorageImage
            src={image}
            alt={`Post image ${index + 1}`}
            className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
            clickable={false}
          />
          {index === 3 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <span className="text-white text-3xl font-bold">+{remainingCount}</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm pointer-events-none">
            {index + 1}/{images.length}
          </div>
          <LikeHeartAnimation />
        </div>
      ))}
    </div>
  );
}
