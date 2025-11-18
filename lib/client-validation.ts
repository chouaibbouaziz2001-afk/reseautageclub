/**
 * Client-Side Input Validation
 * Comprehensive validation utilities
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email is required');
    return { valid: false, errors };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }
  
  if (email.length > 254) {
    errors.push('Email too long (max 254 characters)');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  const errors: string[] = [];
  
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  
  if (password && password.length > 128) {
    errors.push('Password too long (max 128 characters)');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate text input (general purpose)
 */
export function validateText(
  text: string,
  minLength: number = 1,
  maxLength: number = 1000,
  required: boolean = true
): ValidationResult {
  const errors: string[] = [];
  
  if (required && (!text || text.trim().length === 0)) {
    errors.push('This field is required');
    return { valid: false, errors };
  }
  
  if (text && text.length < minLength) {
    errors.push(`Minimum length is ${minLength} characters`);
  }
  
  if (text && text.length > maxLength) {
    errors.push(`Maximum length is ${maxLength} characters`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate URL format
 */
export function validateURL(url: string, required: boolean = false): ValidationResult {
  const errors: string[] = [];
  
  if (!url || url.trim().length === 0) {
    if (required) {
      errors.push('URL is required');
    }
    return { valid: !required, errors };
  }
  
  try {
    const urlObj = new URL(url);
    
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      errors.push('URL must use HTTP or HTTPS protocol');
    }
    
    if (url.length > 2048) {
      errors.push('URL too long (max 2048 characters)');
    }
  } catch {
    errors.push('Invalid URL format');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate file size
 */
export function validateFileSize(
  file: File,
  maxSizeMB: number = 5
): ValidationResult {
  const errors: string[] = [];
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (file.size > maxSizeBytes) {
    errors.push(`File size must be less than ${maxSizeMB}MB`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate file type
 */
export function validateFileType(
  file: File,
  allowedTypes: string[]
): ValidationResult {
  const errors: string[] = [];
  
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} not allowed`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate image dimensions
 */
export async function validateImageDimensions(
  file: File,
  maxWidth: number = 4096,
  maxHeight: number = 4096
): Promise<ValidationResult> {
  const errors: string[] = [];
  
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      if (img.width > maxWidth || img.height > maxHeight) {
        errors.push(`Image dimensions must be ${maxWidth}x${maxHeight} or smaller`);
      }
      
      resolve({ valid: errors.length === 0, errors });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      errors.push('Invalid image file');
      resolve({ valid: false, errors });
    };
    
    img.src = url;
  });
}

/**
 * Sanitize filename
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 255);
}
