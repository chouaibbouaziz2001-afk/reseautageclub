'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useMediaViewer } from '@/lib/media-viewer-context';
import { Button } from '@/components/ui/button';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize,
  Volume2,
  VolumeX,
  Play,
  Pause,
} from 'lucide-react';
import Image from 'next/image';

export function MediaViewer() {
  const { isOpen, currentIndex, items, closeViewer, nextItem, prevItem } = useMediaViewer();
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; distance: number } | null>(null);

  const currentItem = items[currentIndex];
  const hasMultiple = items.length > 1;

  // Reset zoom and position when changing items
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsLoading(true);
      setError(false);
      setIsPlaying(false);
    }
  }, [currentIndex, isOpen]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeViewer();
          break;
        case 'ArrowLeft':
          if (hasMultiple) prevItem();
          break;
        case 'ArrowRight':
          if (hasMultiple) nextItem();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasMultiple, closeViewer, nextItem, prevItem]);

  // Touch/Pinch zoom for mobile
  useEffect(() => {
    if (!isOpen || currentItem?.type !== 'image') return;

    const container = imageContainerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        touchStartRef.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
          distance,
        };
      } else if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
          distance: 0,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = distance / touchStartRef.current.distance;
        setZoom((prev) => Math.max(0.5, Math.min(5, prev * scale)));
        touchStartRef.current.distance = distance;
      }
    };

    const handleTouchEnd = () => {
      touchStartRef.current = null;
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isOpen, currentItem?.type]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDownload = async () => {
    if (!currentItem) return;

    try {
      const response = await fetch(currentItem.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentItem.alt || `media-${Date.now()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download:', error);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      if (newVolume === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  if (!isOpen || !currentItem) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeViewer();
      }}
    >
      {/* Close button */}
      <Button
        onClick={closeViewer}
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 rounded-full"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Navigation arrows */}
      {hasMultiple && (
        <>
          <Button
            onClick={prevItem}
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 rounded-full h-12 w-12"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            onClick={nextItem}
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20 rounded-full h-12 w-12"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Counter */}
      {hasMultiple && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-black/60 text-white px-4 py-2 rounded-full text-sm font-medium">
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Image viewer */}
      {currentItem.type === 'image' && (
        <>
          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-black/60 rounded-full px-4 py-2">
            <Button
              onClick={handleZoomOut}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
              disabled={zoom <= 0.5}
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              onClick={handleZoomIn}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
              disabled={zoom >= 5}
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
            <div className="w-px h-6 bg-white/20 mx-2" />
            <Button
              onClick={handleDownload}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>

          {/* Image */}
          <div
            ref={imageContainerRef}
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}
            {error && (
              <div className="text-white text-center">
                <p className="text-xl mb-2">Failed to load image</p>
                <Button onClick={() => setError(false)} variant="outline" className="text-white border-white">
                  Try Again
                </Button>
              </div>
            )}
            <div
              className="relative transition-transform duration-200"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                maxWidth: '90vw',
                maxHeight: '90vh',
              }}
            >
              <Image
                src={currentItem.src}
                alt={currentItem.alt || 'Media'}
                width={1920}
                height={1080}
                className="max-w-full max-h-[90vh] object-contain"
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError(true);
                }}
                unoptimized
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Video viewer */}
      {currentItem.type === 'video' && (
        <div className="relative w-full max-w-6xl mx-auto px-4">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
          )}
          <video
            ref={videoRef}
            src={currentItem.src}
            poster={currentItem.poster}
            className="w-full h-auto max-h-[90vh] rounded-lg"
            controls
            onLoadedData={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setError(true);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
              <div className="text-white text-center">
                <p className="text-xl mb-2">Failed to load video</p>
                <Button onClick={() => setError(false)} variant="outline" className="text-white border-white">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Custom controls overlay */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 bg-black/60 rounded-lg px-4 py-3">
            <Button
              onClick={togglePlay}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>

            <Button
              onClick={toggleMute}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>

            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />

            <div className="flex-1" />

            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <Maximize className="h-5 w-5" />
            </Button>

            <Button
              onClick={handleDownload}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-10 w-10"
            >
              <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Hint text */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/60 text-sm text-center">
        {currentItem.type === 'image' ? (
          <>Press ESC to close • Click outside to close • Arrow keys to navigate</>
        ) : (
          <>Press ESC to close • Click outside to close</>
        )}
      </div>
    </div>
  );
}

export default MediaViewer;
