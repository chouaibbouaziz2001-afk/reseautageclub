/**
 * Enhanced Security Utilities
 * Rate Limiting and CSRF Protection
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limiter for client-side actions
 */
export function rateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (entry.count >= maxAttempts) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Clear rate limit for a key
 */
export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * CSRF Token Management
 */
let csrfToken: string | null = null;

/**
 * Generate CSRF token
 */
export function generateCSRFToken(): string {
  if (typeof window === 'undefined') return '';
  
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  csrfToken = token;
  sessionStorage.setItem('csrf_token', token);
  
  return token;
}

/**
 * Get current CSRF token
 */
export function getCSRFToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  if (!csrfToken) {
    csrfToken = sessionStorage.getItem('csrf_token');
  }
  
  return csrfToken;
}

/**
 * Validate CSRF token
 */
export function validateCSRFToken(token: string): boolean {
  const storedToken = getCSRFToken();
  return storedToken !== null && token === storedToken;
}

/**
 * Clear CSRF token
 */
export function clearCSRFToken(): void {
  csrfToken = null;
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('csrf_token');
  }
}

/**
 * Add CSRF token to fetch headers
 */
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken() || generateCSRFToken();
  
  return {
    ...headers,
    'X-CSRF-Token': token,
  };
}
