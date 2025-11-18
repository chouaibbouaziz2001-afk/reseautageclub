"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireProfileSetup?: boolean;
}

export function ProtectedRoute({ children, requireProfileSetup = true }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useDatabase();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (authLoading || profileLoading) {
      return;
    }

    if (!user) {
      console.log('[ProtectedRoute] No user, redirecting to sign-in');
      router.replace('/sign-in');
      return;
    }

    if (requireProfileSetup && profile && !profile.profileCompleted && pathname !== '/profile/setup') {
      console.log('[ProtectedRoute] Profile incomplete, redirecting to setup');
      router.replace('/profile/setup');
      return;
    }

    console.log('[ProtectedRoute] User authenticated and on correct page:', pathname);
    setIsChecking(false);
  }, [user, profile, authLoading, profileLoading, requireProfileSetup, router, pathname]);

  if (authLoading || profileLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
