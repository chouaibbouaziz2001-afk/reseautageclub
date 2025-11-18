"use client";

import { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useLoading } from '@/lib/loading-context';
import { Button } from '@/components/ui/button';
import { MenuDrawer } from '@/components/menu-drawer';
import { UserMenu } from '@/components/user-menu';
import { NotificationBell } from '@/components/notification-bell';
import { usePrefetchRoutes } from '@/lib/route-prefetch';

export const Navigation = memo(function Navigation() {
  const { user } = useAuth();
  const { startLoading } = useLoading();

  usePrefetchRoutes();

  return (
    <nav className="sticky top-0 z-50 bg-gray-950 border-b-2 border-gray-800 shadow-lg safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-16">
          <div className="flex items-center space-x-1 sm:space-x-2 min-w-0 flex-1">
            {user && <MenuDrawer />}
            <Link
              href={user ? "/feed" : "/"}
              className="flex items-center space-x-1.5 sm:space-x-2 group min-w-0"
              onClick={() => startLoading('Loading...')}
            >
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded-lg overflow-hidden ring-2 ring-amber-500 group-hover:ring-amber-400 transition-all flex-shrink-0">
                <Image
                  src="/logo.jpg"
                  alt="ReseautageClub Logo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
              <span className="text-base sm:text-xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent hidden sm:inline truncate">ReseautageClub</span>
            </Link>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {user ? (
              <>
                <NotificationBell />
                <UserMenu />
              </>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-4">
                <Link href="/sign-in" onClick={() => startLoading('Loading sign in...')}>
                  <Button variant="ghost" size="sm" className="text-gray-300 hover:bg-gray-900 hover:text-amber-400 h-9 px-3 text-sm">Sign In</Button>
                </Link>
                <Link href="/sign-up" onClick={() => startLoading('Loading sign up...')}>
                  <Button size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold shadow-md hover:shadow-lg transition-all h-9 px-3 text-sm">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
});
