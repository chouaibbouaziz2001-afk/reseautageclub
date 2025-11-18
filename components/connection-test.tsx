"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function ConnectionTest() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Testing connection...');
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log('[ConnectionTest] Starting connection test...');

        // Test 1: Basic connection
        const { data: testData, error: testError } = await supabase
          .from('profiles')
          .select('count')
          .limit(1);

        if (testError) {
          throw new Error(`Connection test failed: ${testError.message}`);
        }

        // Test 2: Auth status
        const { data: { session } } = await supabase.auth.getSession();

        // Test 3: Fetch posts
        const { data: posts, error: postsError } = await supabase
          .from('posts')
          .select('id')
          .limit(1);

        if (postsError) {
          throw new Error(`Posts query failed: ${postsError.message}`);
        }

        setStatus('success');
        setMessage('All systems operational');
        setDetails({
          authenticated: !!session,
          userEmail: session?.user?.email || 'Not logged in',
          postsAccessible: true,
        });

        console.log('[ConnectionTest] Connection test passed');
      } catch (error: any) {
        console.error('[ConnectionTest] Connection test failed:', error);
        setStatus('error');
        setMessage(error.message || 'Connection failed');
        setDetails({
          error: error.message,
          stack: error.stack,
        });
      }
    };

    testConnection();
  }, []);

  if (status === 'loading') {
    return (
      <Alert className="border-blue-500 bg-blue-500/10">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <AlertTitle className="text-blue-500">Testing Connection</AlertTitle>
        <AlertDescription className="text-gray-300">{message}</AlertDescription>
      </Alert>
    );
  }

  if (status === 'error') {
    return (
      <Alert className="border-red-500 bg-red-500/10">
        <XCircle className="h-4 w-4 text-red-500" />
        <AlertTitle className="text-red-500">Connection Error</AlertTitle>
        <AlertDescription className="text-gray-300">
          <p>{message}</p>
          {details && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer">View Details</summary>
              <pre className="mt-2 p-2 bg-gray-950 rounded overflow-auto">
                {JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-green-500 bg-green-500/10">
      <CheckCircle className="h-4 w-4 text-green-500" />
      <AlertTitle className="text-green-500">Connected</AlertTitle>
      <AlertDescription className="text-gray-300">
        <p>{message}</p>
        {details && (
          <div className="mt-2 text-xs space-y-1">
            <p>Authenticated: {details.authenticated ? 'Yes' : 'No'}</p>
            {details.userEmail && <p>User: {details.userEmail}</p>}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}
