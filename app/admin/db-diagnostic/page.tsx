"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function DatabaseDiagnostic() {
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const runDiagnostics = async () => {
    setLoading(true);
    const diagnostics: any = {};

    // 1. Check Supabase Connection
    try {
      diagnostics.connection = {
        status: 'testing',
        message: 'Testing connection...',
      };

      const { data, error } = await supabase.from('profiles').select('count').limit(1);

      if (error) {
        diagnostics.connection = {
          status: 'error',
          message: `Connection failed: ${error.message}`,
          details: error,
        };
      } else {
        diagnostics.connection = {
          status: 'success',
          message: 'Successfully connected to Supabase',
        };
      }
    } catch (err: any) {
      diagnostics.connection = {
        status: 'error',
        message: `Connection error: ${err.message}`,
      };
    }

    // 2. Check Auth Status
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        diagnostics.auth = {
          status: 'error',
          message: `Auth check failed: ${error.message}`,
        };
      } else if (session) {
        diagnostics.auth = {
          status: 'success',
          message: `Authenticated as: ${session.user.email}`,
          userId: session.user.id,
        };
      } else {
        diagnostics.auth = {
          status: 'warning',
          message: 'Not authenticated',
        };
      }
    } catch (err: any) {
      diagnostics.auth = {
        status: 'error',
        message: `Auth error: ${err.message}`,
      };
    }

    // 3. Check Posts Table
    try {
      const { data, error, count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        diagnostics.posts = {
          status: 'error',
          message: `Posts query failed: ${error.message}`,
          details: error,
        };
      } else {
        diagnostics.posts = {
          status: 'success',
          message: `Found ${count || 0} posts, retrieved ${data?.length || 0}`,
          sampleData: data,
        };
      }
    } catch (err: any) {
      diagnostics.posts = {
        status: 'error',
        message: `Posts error: ${err.message}`,
      };
    }

    // 4. Check Profiles Table
    try {
      const { data, error, count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        diagnostics.profiles = {
          status: 'error',
          message: `Profiles query failed: ${error.message}`,
          details: error,
        };
      } else {
        diagnostics.profiles = {
          status: 'success',
          message: `Found ${count || 0} profiles, retrieved ${data?.length || 0}`,
          sampleData: data,
        };
      }
    } catch (err: any) {
      diagnostics.profiles = {
        status: 'error',
        message: `Profiles error: ${err.message}`,
      };
    }

    // 5. Check Messages Table
    try {
      const { data, error, count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        diagnostics.messages = {
          status: 'error',
          message: `Messages query failed: ${error.message}`,
          details: error,
        };
      } else {
        diagnostics.messages = {
          status: 'success',
          message: `Found ${count || 0} messages, retrieved ${data?.length || 0}`,
        };
      }
    } catch (err: any) {
      diagnostics.messages = {
        status: 'error',
        message: `Messages error: ${err.message}`,
      };
    }

    // 6. Check Communities Table
    try {
      const { data, error, count } = await supabase
        .from('communities')
        .select('*', { count: 'exact', head: false })
        .limit(5);

      if (error) {
        diagnostics.communities = {
          status: 'error',
          message: `Communities query failed: ${error.message}`,
          details: error,
        };
      } else {
        diagnostics.communities = {
          status: 'success',
          message: `Found ${count || 0} communities, retrieved ${data?.length || 0}`,
        };
      }
    } catch (err: any) {
      diagnostics.communities = {
        status: 'error',
        message: `Communities error: ${err.message}`,
      };
    }

    // 7. Check Environment Variables
    diagnostics.environment = {
      status: typeof process.env.NEXT_PUBLIC_SUPABASE_URL !== 'undefined' &&
              typeof process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'undefined'
        ? 'success'
        : 'warning',
      message: `URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing'}, Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing'}`,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set',
    };

    setResults(diagnostics);
    setLoading(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-gray-500 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Database Diagnostics</h1>
          <Button onClick={runDiagnostics} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Run Again
          </Button>
        </div>

        <div className="grid gap-4">
          {Object.entries(results).map(([key, value]: [string, any]) => (
            <Card key={key} className="bg-gray-900 border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white capitalize">
                  {getStatusIcon(value.status)}
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-gray-300">{value.message}</p>

                {value.userId && (
                  <div className="text-sm text-gray-400">
                    <strong>User ID:</strong> {value.userId}
                  </div>
                )}

                {value.url && (
                  <div className="text-sm text-gray-400 break-all">
                    <strong>URL:</strong> {value.url}
                  </div>
                )}

                {value.details && (
                  <details className="text-sm text-gray-400">
                    <summary className="cursor-pointer text-amber-500">View Details</summary>
                    <pre className="mt-2 p-2 bg-gray-950 rounded overflow-auto max-h-40">
                      {JSON.stringify(value.details, null, 2)}
                    </pre>
                  </details>
                )}

                {value.sampleData && (
                  <details className="text-sm text-gray-400">
                    <summary className="cursor-pointer text-amber-500">View Sample Data</summary>
                    <pre className="mt-2 p-2 bg-gray-950 rounded overflow-auto max-h-60">
                      {JSON.stringify(value.sampleData, null, 2)}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Console Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">
              Open your browser console (F12) to view detailed logs from the Supabase client and database queries.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
