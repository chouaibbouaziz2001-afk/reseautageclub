'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application error:', error);

    // If it's a ChunkLoadError, automatically reload the page
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      window.location.reload();
    }
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 mb-6">
            {error.message.includes('Loading chunk') || error.name === 'ChunkLoadError'
              ? 'The page is being updated. Reloading...'
              : 'An unexpected error occurred. Please try again.'}
          </p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleReload}
            className="w-full bg-amber-500 hover:bg-amber-600"
          >
            Reload Page
          </Button>
          <Button
            onClick={reset}
            variant="outline"
            className="w-full"
          >
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
