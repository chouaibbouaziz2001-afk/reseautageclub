"use client";

import React from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-900 border-2 border-red-500 rounded-lg p-8 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-red-400">Something Went Wrong</h2>

            <p className="text-gray-300">
              The application encountered an error. This might be due to:
            </p>

            <ul className="text-left text-sm text-gray-400 space-y-1">
              <li>• Database connection timeout</li>
              <li>• Missing environment variables</li>
              <li>• Network connectivity issues</li>
            </ul>

            {this.state.error && (
              <div className="bg-gray-950 rounded p-3 text-left">
                <p className="text-xs text-red-400 font-mono break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => window.location.reload()}
                className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                Reload Page
              </Button>

              <Button
                onClick={() => this.setState({ hasError: false, error: null })}
                variant="outline"
                className="w-full border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-gray-900"
              >
                Try Again
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              If this persists, check the browser console for more details
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
