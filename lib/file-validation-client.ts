/**
 * Client-side file validation utilities
 * Validates file type and size before uploading
 */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// Magic numbers for file type verification
const FILE_SIGNATURES: Record<string, number[]> = {
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

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates file before upload
 */
export async function validateFileBeforeUpload(file: File): Promise<FileValidationResult> {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size exceeds 5MB limit',
    };
  }

  // Check if file type is allowed
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  // Validate file signature (magic numbers)
  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    const signature = FILE_SIGNATURES[file.type];
    if (!signature) {
      return {
        valid: false,
        error: 'Unknown file type',
      };
    }

    // Verify magic numbers match
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
        error: `File signature mismatch. Declared: ${file.type}, Detected: ${detectedType || 'unknown'}. This may be a malicious file.`,
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('File validation error:', error);
    return {
      valid: false,
      error: 'Failed to validate file',
    };
  }
}

/**
 * Validates multiple files
 */
export async function validateFiles(files: File[]): Promise<FileValidationResult> {
  for (const file of files) {
    const result = await validateFileBeforeUpload(file);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

/**
 * Get human-readable file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
