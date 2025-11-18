/**
 * Enhanced File Upload Validation
 * Complete validation with security checks
 */

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileValidationOptions {
  maxSize?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
  maxDimensions?: { width: number; height: number };
  checkMagicNumbers?: boolean;
}

// File type magic numbers (file signatures)
const MAGIC_NUMBERS: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'video/mp4': [[0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
};

/**
 * Validate file upload
 */
export async function validateFileUpload(
  file: File,
  options: FileValidationOptions = {}
): Promise<FileValidationResult> {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    maxDimensions = { width: 4096, height: 4096 },
    checkMagicNumbers = true
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check file size
  if (file.size > maxSize) {
    errors.push(`File size (${formatBytes(file.size)}) exceeds maximum (${formatBytes(maxSize)})`);
  }

  if (file.size === 0) {
    errors.push('File is empty');
  }

  // 2. Check MIME type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  // 3. Check extension
  const extension = getFileExtension(file.name);
  if (!allowedExtensions.includes(extension)) {
    errors.push(`File extension ${extension} not allowed. Allowed: ${allowedExtensions.join(', ')}`);
  }

  // 4. Check magic numbers (file signature)
  if (checkMagicNumbers && MAGIC_NUMBERS[file.type]) {
    const isValid = await validateMagicNumbers(file, file.type);
    if (!isValid) {
      errors.push('File content does not match declared type (possible malicious file)');
    }
  }

  // 5. For images, check dimensions
  if (file.type.startsWith('image/')) {
    try {
      const dimensions = await getImageDimensions(file);
      
      if (dimensions.width > maxDimensions.width || dimensions.height > maxDimensions.height) {
        errors.push(
          `Image dimensions (${dimensions.width}x${dimensions.height}) exceed maximum (${maxDimensions.width}x${maxDimensions.height})`
        );
      }

      if (dimensions.width < 10 || dimensions.height < 10) {
        warnings.push('Image dimensions are very small');
      }

      const aspectRatio = dimensions.width / dimensions.height;
      if (aspectRatio > 10 || aspectRatio < 0.1) {
        warnings.push('Unusual aspect ratio detected');
      }
    } catch (err) {
      errors.push('Failed to read image dimensions');
    }
  }

  // 6. Filename validation
  const filenameIssues = validateFilename(file.name);
  errors.push(...filenameIssues);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate magic numbers
 */
async function validateMagicNumbers(file: File, mimeType: string): Promise<boolean> {
  const signatures = MAGIC_NUMBERS[mimeType];
  if (!signatures) return true;

  try {
    const buffer = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    return signatures.some(signature => {
      return signature.every((byte, index) => bytes[index] === byte);
    });
  } catch {
    return false;
  }
}

/**
 * Get image dimensions
 */
function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Validate filename
 */
function validateFilename(filename: string): string[] {
  const errors: string[] = [];

  if (filename.length > 255) {
    errors.push('Filename too long (max 255 characters)');
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(filename)) {
    errors.push('Filename contains invalid characters');
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    errors.push('Filename contains path traversal characters');
  }

  // Check for executable extensions
  const executableExts = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js'];
  const ext = getFileExtension(filename);
  if (executableExts.includes(ext)) {
    errors.push('Executable file types not allowed');
  }

  return errors;
}

/**
 * Get file extension
 */
function getFileExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  const extension = getFileExtension(filename);
  const nameWithoutExt = filename.slice(0, -extension.length);
  
  const sanitized = nameWithoutExt
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 200);
  
  return sanitized + extension;
}

/**
 * Generate secure random filename
 */
export function generateSecureFilename(originalFilename: string): string {
  const extension = getFileExtension(originalFilename);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}_${random}${extension}`;
}

/**
 * Validate multiple files
 */
export async function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): Promise<Map<string, FileValidationResult>> {
  const results = new Map<string, FileValidationResult>();
  
  await Promise.all(
    Array.from(files).map(async (file) => {
      const result = await validateFileUpload(file, options);
      results.set(file.name, result);
    })
  );
  
  return results;
}
