"use client";

import { useLoading } from '@/lib/loading-context';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function GlobalLoadingSpinner() {
  const { isLoading, loadingMessage } = useLoading();
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowTimeoutMessage(true);
      }, 10000);

      return () => {
        clearTimeout(timer);
        setShowTimeoutMessage(false);
      };
    } else {
      setShowTimeoutMessage(false);
    }
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy="true"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col items-center gap-4 rounded-lg bg-white dark:bg-gray-900 p-8 shadow-2xl">
        <Loader2 className="h-16 w-16 animate-spin text-amber-500" />
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {loadingMessage}
          </p>
          {showTimeoutMessage && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              This is taking longer than expected. Please wait...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
