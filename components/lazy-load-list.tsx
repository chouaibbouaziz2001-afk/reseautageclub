"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface LazyLoadListProps<T> {
  items: T[];
  itemsPerPage?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  className?: string;
  useInfiniteScroll?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function LazyLoadListComponent<T>({
  items,
  itemsPerPage = 10,
  renderItem,
  loadingComponent,
  emptyComponent,
  className = '',
  useInfiniteScroll = false,
  onLoadMore,
  hasMore: externalHasMore,
  isLoadingMore: externalIsLoading,
}: LazyLoadListProps<T>) {
  const [displayedCount, setDisplayedCount] = useState(itemsPerPage);
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const loadMoreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLoading = externalIsLoading ?? internalIsLoading;
  const hasMore = externalHasMore ?? displayedCount < items.length;
  const displayedItems = items.slice(0, displayedCount);

  const handleLoadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    if (onLoadMore) {
      onLoadMore();
    } else {
      setInternalIsLoading(true);

      loadMoreTimeoutRef.current = setTimeout(() => {
        setDisplayedCount(prev => Math.min(prev + itemsPerPage, items.length));
        setInternalIsLoading(false);
      }, 100);
    }
  }, [isLoading, hasMore, onLoadMore, itemsPerPage, items.length]);

  useEffect(() => {
    if (!useInfiniteScroll || !observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoading) {
          handleLoadMore();
        }
      },
      {
        root: null,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    observer.observe(observerRef.current);

    return () => {
      observer.disconnect();
      if (loadMoreTimeoutRef.current) {
        clearTimeout(loadMoreTimeoutRef.current);
      }
    };
  }, [useInfiniteScroll, hasMore, isLoading, handleLoadMore]);

  useEffect(() => {
    setDisplayedCount(itemsPerPage);
  }, [items.length, itemsPerPage]);

  if (items.length === 0 && emptyComponent) {
    return <>{emptyComponent}</>;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-4">
        {displayedItems.map((item, index) => (
          <div
            key={index}
            className="animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ animationDelay: `${index % itemsPerPage * 30}ms` }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          {loadingComponent || (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-sm text-gray-400">Loading more...</p>
            </div>
          )}
        </div>
      )}

      {!useInfiniteScroll && hasMore && !isLoading && (
        <div className="flex justify-center pt-4 pb-2">
          <Button
            onClick={handleLoadMore}
            variant="outline"
            className="min-w-[200px] border-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 hover:text-amber-300 transition-all duration-300 shadow-lg hover:shadow-amber-500/20"
          >
            Load More
          </Button>
        </div>
      )}

      {!hasMore && items.length > itemsPerPage && (
        <div className="flex justify-center py-6">
          <div className="text-center space-y-2">
            <div className="h-px w-32 bg-gradient-to-r from-transparent via-gray-700 to-transparent mx-auto" />
            <p className="text-sm text-gray-500 font-medium">You've reached the end</p>
          </div>
        </div>
      )}

      {useInfiniteScroll && (
        <div ref={observerRef} className="h-4" aria-hidden="true" />
      )}
    </div>
  );
}

const LazyLoadList = Object.assign(
  LazyLoadListComponent as <T>(props: LazyLoadListProps<T>) => JSX.Element,
  { displayName: "LazyLoadList" }
);

export default LazyLoadList;
