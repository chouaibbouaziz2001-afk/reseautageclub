export function preloadImage(src: string) {
  if (typeof window === 'undefined') return;

  const img = new Image();
  img.src = src;
}

export function preloadImages(srcs: string[]) {
  if (typeof window === 'undefined') return;

  srcs.forEach(src => preloadImage(src));
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function prefetchData(url: string) {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = 'fetch';
  document.head.appendChild(link);
}

export function getOptimizedImageUrl(url: string, width: number = 800): string {
  if (!url) return url;

  if (url.includes('supabase.co/storage')) {
    return `${url}?width=${width}&quality=80`;
  }

  return url;
}

export function lazyLoadComponent(importFn: () => Promise<any>, delay: number = 0) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(importFn());
    }, delay);
  });
}

export const performanceMonitor = {
  measure: (name: string, startMark: string, endMark: string) => {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      window.performance.measure(name, startMark, endMark);
      const measure = window.performance.getEntriesByName(name)[0];
      console.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
    } catch (error) {
      console.warn('Performance measurement failed:', error);
    }
  },

  mark: (name: string) => {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      window.performance.mark(name);
    } catch (error) {
      console.warn('Performance mark failed:', error);
    }
  },

  clearMarks: () => {
    if (typeof window === 'undefined' || !window.performance) return;

    try {
      window.performance.clearMarks();
      window.performance.clearMeasures();
    } catch (error) {
      console.warn('Performance clear failed:', error);
    }
  },
};
