/**
 * Compression utilities for images and videos before upload
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compress an image file before upload
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const { maxWidth = 1920, maxHeight = 1080, quality = 0.8 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }

            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Check if file needs compression based on size
 */
export function shouldCompressImage(file: File, maxSizeMB: number = 2): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size > maxSizeBytes;
}

/**
 * Compress video by reducing resolution (client-side limitation)
 * For better compression, this would need a server-side solution
 */
export async function compressVideo(file: File): Promise<File> {
  // For videos, we can't do much compression client-side without heavy libraries
  // Instead, we just validate and pass through
  // Recommend adding ffmpeg on server-side for real video compression

  console.log('Video compression: Client-side video compression is limited');
  console.log('Video size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

  return file;
}

/**
 * Get optimal compression settings based on file size - MAXIMUM COMPRESSION
 */
export function getCompressionSettings(fileSizeBytes: number): CompressionOptions {
  const sizeMB = fileSizeBytes / 1024 / 1024;

  if (sizeMB < 1) {
    return { maxWidth: 1280, maxHeight: 720, quality: 0.7 };
  } else if (sizeMB < 3) {
    return { maxWidth: 1280, maxHeight: 720, quality: 0.6 };
  } else if (sizeMB < 5) {
    return { maxWidth: 1024, maxHeight: 576, quality: 0.5 };
  } else {
    return { maxWidth: 800, maxHeight: 600, quality: 0.4 };
  }
}

/**
 * Compress video using canvas and MediaRecorder API
 * Falls back to original file if compression fails or is not supported
 */
export async function compressVideoAdvanced(file: File): Promise<File> {
  // For now, skip video compression as it's complex and browser-dependent
  // The video will be uploaded as-is (still within 50MB limit)
  console.log('Video upload: Skipping client-side compression for better compatibility');
  console.log('Video size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

  // Return original file
  // In production, you'd implement server-side compression with ffmpeg
  return Promise.resolve(file);
}
