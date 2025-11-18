import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const PREFETCH_ROUTES = [
  '/feed',
  '/network',
  '/messages',
  '/communities',
  '/cofounder-match',
  '/events',
  '/profile',
];

export function usePrefetchRoutes() {
  const router = useRouter();

  useEffect(() => {
    const prefetchWithDelay = (route: string, delay: number) => {
      setTimeout(() => {
        router.prefetch(route);
      }, delay);
    };

    PREFETCH_ROUTES.forEach((route, index) => {
      prefetchWithDelay(route, index * 100);
    });
  }, [router]);
}

export function prefetchRoute(router: any, route: string) {
  router.prefetch(route);
}
