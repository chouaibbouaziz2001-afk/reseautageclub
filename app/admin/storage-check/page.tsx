"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface CheckResult {
  totalPosts: number;
  postsWithMedia: number;
  storageReferences: number;
  base64Blobs: number;
  blobUrls: number;
  filesChecked: number;
  filesAccessible: number;
  filesFailed: number;
  failedFiles: string[];
}

export default function StorageCheckPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !user) {
      router.replace('/sign-in');
    }
  }, [mounted, user, router]);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);

    try {
      const { data: posts, error } = await supabase
        .from('posts')
        .select('id, image_url, video_url, media_type')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const checkResult: CheckResult = {
        totalPosts: posts.length,
        postsWithMedia: 0,
        storageReferences: 0,
        base64Blobs: 0,
        blobUrls: 0,
        filesChecked: 0,
        filesAccessible: 0,
        filesFailed: 0,
        failedFiles: [],
      };

      for (const post of posts) {
        const mediaUrls = [post.image_url, post.video_url].filter(Boolean);

        if (mediaUrls.length === 0) continue;

        checkResult.postsWithMedia++;

        for (const url of mediaUrls) {
          if (!url) continue;

          if (url.startsWith('data:')) {
            checkResult.base64Blobs++;
          } else if (url.startsWith('blob:')) {
            checkResult.blobUrls++;
          } else if (url.startsWith('user-media:')) {
            checkResult.storageReferences++;
            checkResult.filesChecked++;

            const path = url.replace('user-media:', '');
            try {
              const { data: signedUrl, error: signError } = await supabase.storage
                .from('user-media')
                .createSignedUrl(path, 60);

              if (signError) {
                checkResult.filesFailed++;
                checkResult.failedFiles.push(path);
              } else {
                const response = await fetch(signedUrl.signedUrl, { method: 'HEAD' });
                if (response.ok) {
                  checkResult.filesAccessible++;
                } else {
                  checkResult.filesFailed++;
                  checkResult.failedFiles.push(path);
                }
              }
            } catch (err) {
              checkResult.filesFailed++;
              checkResult.failedFiles.push(path);
            }
          }
        }
      }

      setResult(checkResult);
    } catch (error) {
      console.error('Check failed:', error);
      alert('Failed to run storage check');
    } finally {
      setChecking(false);
    }
  };

  if (!mounted || !user) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="bg-gray-900/60 border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl text-amber-400">Storage Migration Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-gray-300">
                This tool checks the last 50 posts to verify that all media is stored in Supabase Storage.
              </p>
              <Button
                onClick={runCheck}
                disabled={checking}
                className="bg-amber-500 hover:bg-amber-600 text-gray-900"
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Run Check'
                )}
              </Button>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card className="bg-gray-800/50">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-100">{result.totalPosts}</div>
                        <div className="text-sm text-gray-400">Total Posts Checked</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-100">{result.postsWithMedia}</div>
                        <div className="text-sm text-gray-400">Posts with Media</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${result.storageReferences === result.postsWithMedia && result.postsWithMedia > 0 ? 'bg-green-900/20 border-green-500' : 'bg-gray-800/50'}`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <div className="text-3xl font-bold text-gray-100">{result.storageReferences}</div>
                        <div className="text-sm text-gray-400">Storage References</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${result.base64Blobs > 0 || result.blobUrls > 0 ? 'bg-red-900/20 border-red-500' : 'bg-gray-800/50'}`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        {result.base64Blobs > 0 || result.blobUrls > 0 ? (
                          <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                        ) : (
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        )}
                        <div className="text-3xl font-bold text-gray-100">{result.base64Blobs + result.blobUrls}</div>
                        <div className="text-sm text-gray-400">Blob/Base64 (Bad)</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gray-800/50">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-gray-100">{result.filesChecked}</div>
                        <div className="text-sm text-gray-400">Files Checked</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className={`${result.filesFailed > 0 ? 'bg-red-900/20 border-red-500' : 'bg-green-900/20 border-green-500'}`}>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        {result.filesFailed > 0 ? (
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                        ) : (
                          <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        )}
                        <div className="text-3xl font-bold text-gray-100">{result.filesAccessible}/{result.filesChecked}</div>
                        <div className="text-sm text-gray-400">Files Accessible</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {result.failedFiles.length > 0 && (
                  <Card className="bg-red-900/10 border-red-500">
                    <CardHeader>
                      <CardTitle className="text-red-400 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" />
                        Failed Files
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1 text-sm text-gray-300 font-mono max-h-48 overflow-y-auto">
                        {result.failedFiles.map((file, i) => (
                          <li key={i} className="break-all">{file}</li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {result.base64Blobs === 0 && result.blobUrls === 0 && result.filesFailed === 0 && (
                  <Card className="bg-green-900/20 border-green-500">
                    <CardContent className="pt-6 text-center">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                      <h3 className="text-xl font-bold text-green-400 mb-2">All Clear!</h3>
                      <p className="text-gray-300">
                        All media is properly stored in Supabase Storage and accessible.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
