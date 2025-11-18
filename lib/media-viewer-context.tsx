'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

export interface MediaItem {
  type: 'image' | 'video';
  src: string;
  alt?: string;
  poster?: string; // For videos
}

interface MediaViewerContextType {
  isOpen: boolean;
  currentIndex: number;
  items: MediaItem[];
  openViewer: (items: MediaItem[], startIndex?: number) => void;
  closeViewer: () => void;
  nextItem: () => void;
  prevItem: () => void;
  setCurrentIndex: (index: number) => void;
}

const MediaViewerContext = createContext<MediaViewerContextType | undefined>(undefined);

export function MediaViewerProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [items, setItems] = useState<MediaItem[]>([]);

  const openViewer = useCallback((newItems: MediaItem[], startIndex = 0) => {
    setItems(newItems);
    setCurrentIndex(startIndex);
    setIsOpen(true);
    // Prevent body scroll when viewer is open
    document.body.style.overflow = 'hidden';
  }, []);

  const closeViewer = useCallback(() => {
    setIsOpen(false);
    setItems([]);
    setCurrentIndex(0);
    // Restore body scroll
    document.body.style.overflow = '';
  }, []);

  const nextItem = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prevItem = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  return (
    <MediaViewerContext.Provider
      value={{
        isOpen,
        currentIndex,
        items,
        openViewer,
        closeViewer,
        nextItem,
        prevItem,
        setCurrentIndex,
      }}
    >
      {children}
    </MediaViewerContext.Provider>
  );
}

export function useMediaViewer() {
  const context = useContext(MediaViewerContext);
  if (context === undefined) {
    throw new Error('useMediaViewer must be used within a MediaViewerProvider');
  }
  return context;
}
