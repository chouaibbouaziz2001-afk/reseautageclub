"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warning' | 'pending';
  message: string;
  details?: string;
}

export function ProductionReadinessCheck() {
  const [checks, setChecks] = useState<CheckResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    runChecks();
  }, []);

  const runChecks = async () => {
    setIsRunning(true);
    const results: CheckResult[] = [];

    // Check 1: Environment Variables
    results.push(await checkEnvironmentVariables());

    // Check 2: Database Connection
    results.push(await checkDatabaseConnection());

    // Check 3: Authentication
    results.push(await checkAuthentication());

    // Check 4: Storage Access
    results.push(await checkStorageAccess());

    // Check 5: API Routes
    results.push(await checkApiRoutes());

    // Check 6: Profiles Table
    results.push(await checkProfilesTable());

    // Check 7: Posts Table
    results.push(await checkPostsTable());

    // Check 8: Real-time Subscriptions
    results.push(await checkRealtimeAccess());

    setChecks(results);
    setIsRunning(false);
  };

  const checkEnvironmentVariables = async (): Promise<CheckResult> => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return {
        name: 'Environment Variables',
        status: 'fail',
        message: 'Missing required environment variables',
        details: `URL: ${url ? 'Present' : 'Missing'}, Key: ${key ? 'Present' : 'Missing'}`,
      };
    }

    if (!url.startsWith('https://')) {
      return {
        name: 'Environment Variables',
        status: 'warning',
        message: 'Supabase URL should use HTTPS',
        details: url,
      };
    }

    return {
      name: 'Environment Variables',
      status: 'pass',
      message: 'All environment variables present and valid',
      details: `URL: ${url.substring(0, 30)}...`,
    };
  };

  const checkDatabaseConnection = async (): Promise<CheckResult> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        return {
          name: 'Database Connection',
          status: 'fail',
          message: 'Failed to connect to database',
          details: error.message,
        };
      }

      return {
        name: 'Database Connection',
        status: 'pass',
        message: 'Successfully connected to database',
      };
    } catch (err: any) {
      return {
        name: 'Database Connection',
        status: 'fail',
        message: 'Database connection error',
        details: err.message,
      };
    }
  };

  const checkAuthentication = async (): Promise<CheckResult> => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        return {
          name: 'Authentication',
          status: 'warning',
          message: 'Auth check completed with warnings',
          details: error.message,
        };
      }

      return {
        name: 'Authentication',
        status: 'pass',
        message: session ? 'User authenticated' : 'Auth system functional (not logged in)',
        details: session ? `User: ${session.user.email}` : 'No active session',
      };
    } catch (err: any) {
      return {
        name: 'Authentication',
        status: 'fail',
        message: 'Authentication system error',
        details: err.message,
      };
    }
  };

  const checkStorageAccess = async (): Promise<CheckResult> => {
    try {
      const { data, error } = await supabase.storage.listBuckets();

      if (error) {
        return {
          name: 'Storage Access',
          status: 'fail',
          message: 'Failed to access storage',
          details: error.message,
        };
      }

      return {
        name: 'Storage Access',
        status: 'pass',
        message: `Storage accessible (${data.length} buckets)`,
        details: data.map(b => b.name).join(', '),
      };
    } catch (err: any) {
      return {
        name: 'Storage Access',
        status: 'fail',
        message: 'Storage access error',
        details: err.message,
      };
    }
  };

  const checkApiRoutes = async (): Promise<CheckResult> => {
    try {
      const response = await fetch('/api/posts/create', {
        method: 'OPTIONS',
      });

      if (!response.ok && response.status !== 405) {
        return {
          name: 'API Routes',
          status: 'warning',
          message: 'API routes may not be accessible',
          details: `Status: ${response.status}`,
        };
      }

      return {
        name: 'API Routes',
        status: 'pass',
        message: 'API routes are accessible',
      };
    } catch (err: any) {
      return {
        name: 'API Routes',
        status: 'fail',
        message: 'Failed to access API routes',
        details: err.message,
      };
    }
  };

  const checkProfilesTable = async (): Promise<CheckResult> => {
    try {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return {
          name: 'Profiles Table',
          status: 'fail',
          message: 'Failed to access profiles table',
          details: error.message,
        };
      }

      return {
        name: 'Profiles Table',
        status: 'pass',
        message: `Profiles table accessible (${count} profiles)`,
      };
    } catch (err: any) {
      return {
        name: 'Profiles Table',
        status: 'fail',
        message: 'Profiles table error',
        details: err.message,
      };
    }
  };

  const checkPostsTable = async (): Promise<CheckResult> => {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      if (error) {
        return {
          name: 'Posts Table',
          status: 'fail',
          message: 'Failed to access posts table',
          details: error.message,
        };
      }

      return {
        name: 'Posts Table',
        status: 'pass',
        message: `Posts table accessible (${count} posts)`,
      };
    } catch (err: any) {
      return {
        name: 'Posts Table',
        status: 'fail',
        message: 'Posts table error',
        details: err.message,
      };
    }
  };

  const checkRealtimeAccess = async (): Promise<CheckResult> => {
    try {
      const channel = supabase.channel('test-channel');

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          channel.unsubscribe();
          reject(new Error('Timeout'));
        }, 5000);

        channel
          .on('presence', { event: 'sync' }, () => {
            clearTimeout(timeout);
            channel.unsubscribe();
            resolve();
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              clearTimeout(timeout);
              channel.unsubscribe();
              resolve();
            }
          });
      });

      return {
        name: 'Real-time Access',
        status: 'pass',
        message: 'Real-time subscriptions functional',
      };
    } catch (err: any) {
      return {
        name: 'Real-time Access',
        status: 'warning',
        message: 'Real-time may not be fully functional',
        details: err.message,
      };
    }
  };

  const getStatusIcon = (status: CheckResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'fail':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-5 w-5 text-gray-500 animate-spin" />;
    }
  };

  const getStatusBadge = (status: CheckResult['status']) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-500">Pass</Badge>;
      case 'fail':
        return <Badge className="bg-red-500">Fail</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Warning</Badge>;
      case 'pending':
        return <Badge className="bg-gray-500">Pending</Badge>;
    }
  };

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warningCount = checks.filter(c => c.status === 'warning').length;

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Production Readiness Check</CardTitle>
        <CardDescription>
          Verifying all systems are operational for production deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRunning && checks.length === 0 && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Running Checks</AlertTitle>
            <AlertDescription>
              Verifying environment, database, authentication, and more...
            </AlertDescription>
          </Alert>
        )}

        {checks.length > 0 && (
          <>
            <div className="flex gap-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">{passCount} Passed</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm">{failCount} Failed</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">{warningCount} Warnings</span>
              </div>
            </div>

            {failCount > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Critical Issues Detected</AlertTitle>
                <AlertDescription>
                  {failCount} critical {failCount === 1 ? 'issue' : 'issues'} must be resolved before production deployment.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-3">
              {checks.map((check, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  <div className="mt-0.5">
                    {getStatusIcon(check.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{check.name}</span>
                      {getStatusBadge(check.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {check.message}
                    </p>
                    {check.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {check.details}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={runChecks}
              disabled={isRunning}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isRunning ? 'Running Checks...' : 'Run Checks Again'}
            </button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
