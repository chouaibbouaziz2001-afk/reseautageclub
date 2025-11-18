"use client";

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useLoading } from '@/lib/loading-context';

export function useNavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { stopLoading } = useLoading();

  useEffect(() => {
    stopLoading();
  }, [pathname, searchParams, stopLoading]);
}
