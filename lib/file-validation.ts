// Secure file validation utilities

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic numbers for file type verification
const FILE_SIGNATURES = {
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/gif': [0x47, 0x49, 0x46, 0x38],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF
  'video/mp4': [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], // ftyp
  'video/webm': [0x1A, 0x45, 0xDF, 0xA3],
  'audio/mpeg': [0xFF, 0xFB], // MP3
  'audio/mp4': [0x00, 0x00, 0x00], // M4A
  'audio/webm': [0x1A, 0x45, 0xDF, 0xA3],
};

const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
];

interface ValidationResult {
  valid: boolean;
  error?: string;
  contentType?: string;
}

/**
 * Validates file based on magic numbers (file signature)
 */
export function validateFileSignature(buffer: ArrayBuffer, declaredType: string): ValidationResult {
  const uint8Array = new Uint8Array(buffer);

  // Check file size
  if (buffer.byteLength > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit',
    };
  }

  // Check if declared type is allowed
  if (!ALLOWED_TYPES.includes(declaredType)) {
    return {
      valid: false,
      error: 'File type not allowed',
    };
  }

  // Get signature for declared type
  const signature = FILE_SIGNATURES[declaredType as keyof typeof FILE_SIGNATURES];
  if (!signature) {
    return {
      valid: false,
      error: 'Unknown file type',
    };
  }

  // Verify magic numbers
  const matches = signature.every((byte, index) => {
    if (index >= uint8Array.length) return false;
    return uint8Array[index] === byte;
  });

  if (!matches) {
    // Try to detect actual file type
    let detectedType: string | null = null;

    for (const [type, sig] of Object.entries(FILE_SIGNATURES)) {
      const typeMatches = sig.every((byte, index) => {
        if (index >= uint8Array.length) return false;
        return uint8Array[index] === byte;
      });

      if (typeMatches) {
        detectedType = type;
        break;
      }
    }

    return {
      valid: false,
      error: `File signature mismatch. Declared: ${declaredType}, Detected: ${detectedType || 'unknown'}`,
    };
  }

  return {
    valid: true,
    contentType: declaredType,
  };
}

/**
 * Generates a secure random filename
 */
export function generateSecureFilename(extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const random2 = Math.random().toString(36).substring(2, 15);

  // Remove any dots from extension to prevent path traversal
  const safeExtension = extension.replace(/\./g, '').toLowerCase();

  return `${timestamp}_${random}${random2}.${safeExtension}`;
}

/**
 * Sanitizes user-provided filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let safe = filename.replace(/[\/\\\.\.|\x00]/g, '');

  // Remove special characters
  safe = safe.replace(/[^a-zA-Z0-9_\-\.]/g, '_');

  // Limit length
  if (safe.length > 100) {
    safe = safe.substring(0, 100);
  }

  return safe || 'file';
}

/**
 * Gets file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
  };

  return map[contentType] || 'bin';
}

/**
 * Validates path for security
 */
export function validatePath(path: string, userId: string, bucket: string): ValidationResult {
  // Check for path traversal
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) {
    return {
      valid: false,
      error: 'Invalid path: contains illegal characters',
    };
  }

  // Check for null bytes
  if (path.includes('\x00')) {
    return {
      valid: false,
      error: 'Invalid path: contains null byte',
    };
  }

  // For user-media bucket, ensure path starts with user ID
  if (bucket === 'user-media' && !path.startsWith(userId + '/')) {
    return {
      valid: false,
      error: 'Invalid path: must be within user directory',
    };
  }

  // Check path length
  if (path.length > 500) {
    return {
      valid: false,
      error: 'Path too long',
    };
  }

  return { valid: true };
}
