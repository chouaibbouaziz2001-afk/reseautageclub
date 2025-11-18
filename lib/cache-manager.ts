/**
 * Cache Strategies
 * Memory cache and localStorage cache utilities
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private readonly prefix = 'rc_cache_';

  /**
   * Set cache entry
   */
  set<T>(key: string, data: T, ttl: number = 3600000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl
    };

    // Memory cache
    this.memoryCache.set(key, entry);

    // LocalStorage cache (only for serializable data)
    if (typeof window !== 'undefined' && this.isSerializable(data)) {
      try {
        localStorage.setItem(
          this.prefix + key,
          JSON.stringify(entry)
        );
      } catch (err) {
        console.warn('Failed to set localStorage cache:', err);
      }
    }
  }

  /**
   * Get cache entry
   */
  get<T>(key: string): T | null {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.data;
    }

    // Check localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.prefix + key);
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored);
          if (!this.isExpired(entry)) {
            // Restore to memory cache
            this.memoryCache.set(key, entry);
            return entry.data;
          } else {
            // Clean up expired entry
            localStorage.removeItem(this.prefix + key);
          }
        }
      } catch (err) {
        console.warn('Failed to get localStorage cache:', err);
      }
    }

    return null;
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.prefix + key);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.memoryCache.clear();
    if (typeof window !== 'undefined') {
      Object.keys(localStorage)
        .filter(k => k.startsWith(this.prefix))
        .forEach(k => localStorage.removeItem(k));
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Check if data is serializable
   */
  private isSerializable(data: any): boolean {
    try {
      JSON.stringify(data);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get or fetch pattern
   */
  async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600000
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetchFn();
    this.set(key, data, ttl);
    return data;
  }
}

// Singleton
export const cache = new CacheManager();

/**
 * Cache decorators and helpers
 */

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  ttl: number = 3600000
): T {
  const cache = new Map<string, { result: ReturnType<T>; timestamp: number }>();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.result;
    }

    const result = fn(...args);
    cache.set(key, { result, timestamp: Date.now() });

    return result;
  }) as T;
}

/**
 * Cache keys for common data
 */
export const CacheKeys = {
  profile: (userId: string) => `profile_${userId}`,
  posts: (page: number) => `posts_page_${page}`,
  community: (id: string) => `community_${id}`,
  communities: 'communities_list',
  connections: (userId: string) => `connections_${userId}`,
  notifications: (userId: string) => `notifications_${userId}`,
} as const;

/**
 * Cache TTLs (in milliseconds)
 */
export const CacheTTL = {
  short: 5 * 60 * 1000,      // 5 minutes
  medium: 30 * 60 * 1000,     // 30 minutes
  long: 60 * 60 * 1000,       // 1 hour
  day: 24 * 60 * 60 * 1000,   // 24 hours
} as const;
