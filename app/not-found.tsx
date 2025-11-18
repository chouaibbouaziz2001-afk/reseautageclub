'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Home, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function NotFound() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    console.log('[404] Page not found:', pathname);
    console.log('[404] User authenticated:', !!user);
  }, [pathname, user]);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-gray-900/60 border-gray-800">
        <CardContent className="pt-6 text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl font-bold text-amber-500">404</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Page Not Found
            </h2>
            <p className="text-gray-400 mb-2">
              The page you're looking for doesn't exist.
            </p>
            {pathname && (
              <p className="text-sm text-gray-500 font-mono bg-gray-800/50 px-3 py-2 rounded mt-4">
                {pathname}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button
              asChild
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
            >
              <Link href={user ? "/feed" : "/"}>
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Link>
            </Button>
            <Button
              onClick={() => window.history.back()}
              variant="outline"
              className="w-full border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-800">
            <p className="text-sm text-gray-500 mb-3">
              Quick links:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button asChild variant="link" className="text-amber-500 hover:text-amber-400">
                <Link href="/feed">Feed</Link>
              </Button>
              <Button asChild variant="link" className="text-amber-500 hover:text-amber-400">
                <Link href="/network">Network</Link>
              </Button>
              <Button asChild variant="link" className="text-amber-500 hover:text-amber-400">
                <Link href="/communities">Communities</Link>
              </Button>
              <Button asChild variant="link" className="text-amber-500 hover:text-amber-400">
                <Link href="/events">Events</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
