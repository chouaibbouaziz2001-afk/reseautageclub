/**
 * Utility functions for copying links across the platform
 */

export interface CopyLinkOptions {
  type: 'post' | 'profile' | 'event' | 'message' | 'community' | 'cofounder' | 'course' | 'lesson';
  id: string;
  communityId?: string;
  courseId?: string;
  title?: string;
}

/**
 * Generate a shareable URL based on the content type
 */
export function generateShareableUrl(options: CopyLinkOptions): string {
  // Get base URL - works in both development and production
  let baseUrl = '';
  if (typeof window !== 'undefined') {
    baseUrl = window.location.origin;
  }

  // Fallback to environment variables if available
  if (!baseUrl && typeof process !== 'undefined' && process.env) {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || process.env.NETLIFY_URL || '';
    if (baseUrl && !baseUrl.startsWith('http')) {
      baseUrl = `https://${baseUrl}`;
    }
  }

  switch (options.type) {
    case 'post':
      return `${baseUrl}/post/${options.id}`;

    case 'profile':
      return `${baseUrl}/profile/${options.id}`;

    case 'event':
      return `${baseUrl}/events?event=${options.id}`;

    case 'message':
      // Messages are private, return conversation link
      return `${baseUrl}/messages?conversation=${options.id}`;

    case 'community':
      return `${baseUrl}/communities/${options.id}`;

    case 'cofounder':
      return `${baseUrl}/cofounder-match/chat/${options.id}`;

    case 'course':
      if (!options.communityId) {
        throw new Error('Community ID required for course links');
      }
      return `${baseUrl}/communities/${options.communityId}/course/${options.id}`;

    case 'lesson':
      if (!options.communityId || !options.courseId) {
        throw new Error('Community ID and Course ID required for lesson links');
      }
      return `${baseUrl}/communities/${options.communityId}/course/${options.courseId}/lesson/${options.id}`;

    default:
      return baseUrl;
  }
}

/**
 * Copy a link to the clipboard
 */
export async function copyLinkToClipboard(
  options: CopyLinkOptions
): Promise<boolean> {
  try {
    const url = generateShareableUrl(options);
    console.log('[CopyLink] Copying URL:', url);

    // Check if clipboard API is available and we're in a secure context
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.isSecureContext) {
      // Use modern clipboard API
      await navigator.clipboard.writeText(url);
      console.log('[CopyLink] Successfully copied using clipboard API');
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      console.log('[CopyLink] Using fallback method');
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        textArea.remove();
        console.log('[CopyLink] Fallback method result:', successful);
        return successful;
      } catch (err) {
        textArea.remove();
        console.error('[CopyLink] Fallback method failed:', err);
        return false;
      }
    }
  } catch (error) {
    console.error('[CopyLink] Failed to copy link:', error);
    return false;
  }
}

/**
 * Get a formatted message for the toast notification
 */
export function getCopySuccessMessage(type: CopyLinkOptions['type']): string {
  const messages: Record<CopyLinkOptions['type'], string> = {
    post: 'Post link copied to clipboard',
    profile: 'Profile link copied to clipboard',
    event: 'Event link copied to clipboard',
    message: 'Conversation link copied to clipboard',
    community: 'Community link copied to clipboard',
    cofounder: 'Co-founder match link copied to clipboard',
    course: 'Course link copied to clipboard',
    lesson: 'Lesson link copied to clipboard',
  };

  return messages[type];
}
