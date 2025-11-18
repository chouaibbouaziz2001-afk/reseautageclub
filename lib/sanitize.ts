import DOMPurify from 'isomorphic-dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Removes dangerous tags, attributes, and JavaScript
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return '';

  const config = {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
    ALLOWED_ATTR: ['href', 'title', 'target'],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    RETURN_TRUSTED_TYPE: false,
  };

  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitizes plain text to prevent XSS
 * Escapes HTML entities
 */
export function sanitizeText(text: string): string {
  if (!text) return '';

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitizes user input for search queries
 * Removes SQL injection characters and limits length
 */
export function sanitizeSearch(query: string): string {
  if (!query) return '';

  // Remove dangerous characters
  let safe = query
    .replace(/[%_;'"`\\]/g, '')
    .replace(/\x00/g, '')
    .trim();

  // Limit length
  if (safe.length > 100) {
    safe = safe.substring(0, 100);
  }

  return safe;
}

/**
 * Validates and sanitizes UUID
 */
export function sanitizeUuid(uuid: string): string | null {
  if (!uuid) return null;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    return null;
  }

  return uuid.toLowerCase();
}

/**
 * Sanitizes URL to prevent XSS and open redirects
 */
export function sanitizeUrl(url: string): string | null {
  if (!url) return null;

  // Only allow http, https, and mailto protocols
  const allowedProtocols = ['http:', 'https:', 'mailto:'];

  try {
    const parsed = new URL(url);

    if (!allowedProtocols.includes(parsed.protocol)) {
      return null;
    }

    // Prevent javascript: and data: URLs
    if (url.toLowerCase().includes('javascript:') || url.toLowerCase().includes('data:')) {
      return null;
    }

    return url;
  } catch {
    // Invalid URL
    return null;
  }
}

/**
 * Sanitizes user profile data
 */
export function sanitizeProfile(profile: {
  bio?: string;
  location?: string;
  company?: string;
  position?: string;
  website?: string;
}): typeof profile {
  return {
    bio: profile.bio ? sanitizeText(profile.bio.substring(0, 500)) : undefined,
    location: profile.location ? sanitizeText(profile.location.substring(0, 100)) : undefined,
    company: profile.company ? sanitizeText(profile.company.substring(0, 100)) : undefined,
    position: profile.position ? sanitizeText(profile.position.substring(0, 100)) : undefined,
    website: profile.website ? sanitizeUrl(profile.website) || undefined : undefined,
  };
}
