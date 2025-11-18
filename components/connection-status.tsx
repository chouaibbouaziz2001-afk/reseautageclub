"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Wifi } from 'lucide-react';

export function ConnectionStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'hidden'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [envStatus, setEnvStatus] = useState<{
    url: string | undefined;
    hasKey: boolean;
    keyLength: number;
  } | null>(null);

  useEffect(() => {
    checkConnection();

    // Auto-hide after 8 seconds regardless of status
    const hideTimer = setTimeout(() => {
      setStatus('hidden');
    }, 8000);

    return () => clearTimeout(hideTimer);
  }, []);

  const checkConnection = async () => {
    try {
      console.log('[ConnectionStatus] Starting connection check...');

      // SECURITY: Never hardcode credentials - use environment variables only
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      
      if (!url || !key) {
        throw new Error('Supabase credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
      }

      console.log('[ConnectionStatus] Environment variables:', {
        url: url ? 'SET' : 'MISSING',
        urlValue: url,
        key: key ? 'SET (length: ' + key?.length + ')' : 'MISSING',
        keyPreview: key ? key.substring(0, 30) + '...' : 'MISSING',
      });

      setEnvStatus({
        url: url,
        hasKey: !!key,
        keyLength: key?.length || 0,
      });

      console.log('[ConnectionStatus] Testing database connection with timeout...');

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000);
      });

      // Test with direct fetch with timeout
      const fetchPromise = fetch(`${url}/rest/v1/profiles?select=count&limit=1`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
      });

      const testResponse = await Promise.race([fetchPromise, timeoutPromise]) as Response;

      console.log('[ConnectionStatus] Direct fetch response:', {
        status: testResponse.status,
        statusText: testResponse.statusText,
        ok: testResponse.ok,
      });

      if (!testResponse.ok) {
        const errorText = await testResponse.text();
        console.error('[ConnectionStatus] Direct fetch error:', errorText);
        throw new Error(`HTTP ${testResponse.status}: ${errorText}`);
      }

      console.log('[ConnectionStatus] Connection successful!');
      setStatus('connected');
      setError(null);

      // Auto-hide after 2 seconds on success
      setTimeout(() => {
        setStatus('connected');
      }, 2000);
    } catch (err) {
      console.error('[ConnectionStatus] Connection check failed:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Don't render anything if hidden
  if (status === 'hidden') {
    return null;
  }

  if (status === 'checking') {
    return (
      <Alert className="fixed bottom-4 right-4 z-50 w-96 bg-blue-900/90 border-blue-500 text-white">
        <Wifi className="h-4 w-4 animate-pulse" />
        <AlertTitle>Checking Connection</AlertTitle>
        <AlertDescription>
          Verifying database connection...
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'error') {
    return (
      <Alert className="fixed bottom-4 right-4 z-50 w-96 bg-red-900/90 border-red-500 text-white">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Connection Error</AlertTitle>
        <AlertDescription className="space-y-2">
          <p className="text-sm">{error}</p>
          {envStatus && (
            <div className="text-xs bg-red-950/50 p-2 rounded mt-2 font-mono">
              <div>URL: {envStatus.url}</div>
              <div>Key: {envStatus.hasKey ? `Present (${envStatus.keyLength} chars)` : 'Missing'}</div>
            </div>
          )}
          <button
            onClick={checkConnection}
            className="text-xs underline hover:no-underline mt-2"
          >
            Retry Connection
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  // Connected state - will auto-hide via timer
  return null;
}
