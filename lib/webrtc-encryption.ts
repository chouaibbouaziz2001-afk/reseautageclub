import CryptoJS from 'crypto-js';

// SECURITY: Encryption key must be set via environment variable
// Server-side: Use WEBRTC_ENCRYPTION_KEY (not exposed to client)
// Client-side: Use NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY (exposed but necessary for client-side encryption)
const ENCRYPTION_KEY =
  typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY || (() => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY must be set in production');
        }
        console.warn('⚠️ SECURITY: Using default encryption key. Set NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY in production!');
        return 'default-key-replace-in-production';
      })()
    : process.env.WEBRTC_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY || (() => {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('WEBRTC_ENCRYPTION_KEY or NEXT_PUBLIC_WEBRTC_ENCRYPTION_KEY must be set in production');
        }
        console.warn('⚠️ SECURITY: Using default encryption key. Set WEBRTC_ENCRYPTION_KEY in production!');
        return 'default-key-replace-in-production';
      })();

/**
 * Encrypts WebRTC signaling data (SDP offers/answers)
 * @param data - Plain text data to encrypt
 * @returns Encrypted string
 */
export function encryptSignalingData(data: string): string {
  if (!data) return '';

  try {
    const encrypted = CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt signaling data');
  }
}

/**
 * Decrypts WebRTC signaling data (SDP offers/answers)
 * @param encryptedData - Encrypted string
 * @returns Decrypted plain text
 */
export function decryptSignalingData(encryptedData: string): string {
  if (!encryptedData) return '';

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      throw new Error('Decryption failed - invalid key or corrupted data');
    }

    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt signaling data');
  }
}

/**
 * Generates a secure room ID for WebRTC calls
 */
export function generateSecureRoomId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = CryptoJS.lib.WordArray.random(16).toString();
  return `${timestamp}-${randomPart}`;
}

/**
 * Hashes sensitive data (e.g., for logging without exposing actual values)
 */
export function hashSensitiveData(data: string): string {
  return CryptoJS.SHA256(data).toString();
}
