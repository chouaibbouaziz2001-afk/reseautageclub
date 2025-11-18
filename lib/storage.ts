import { supabase } from './supabase';
import { validateFileBeforeUpload } from './file-validation-client';

export interface UploadOptions {
  compress?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface UploadResult {
  url: string;
  path: string;
  publicUrl?: string;
}

const DEFAULT_OPTIONS: Required<UploadOptions> = {
  compress: true,
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
};

export function getWebsiteAsset(path: string): string {
  return getPublicUrl('websiteconfig', path);
}

export async function getUserMediaSignedUrl(path: string, expiresInSeconds: number = 3600): Promise<string> {
  const { data } = supabase.storage.from('user-media').getPublicUrl(path);
  return data.publicUrl;
}

async function compressImage(
  file: File,
  options: Required<UploadOptions>
): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > options.maxWidth || height > options.maxHeight) {
          if (width > height) {
            if (width > options.maxWidth) {
              height = (height * options.maxWidth) / width;
              width = options.maxWidth;
            }
          } else {
            if (height > options.maxHeight) {
              width = (width * options.maxHeight) / height;
              height = options.maxHeight;
            }
          }
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
          options.quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
  });
}

async function compressVideo(file: File): Promise<File> {
  return file;
}

async function compressAudio(file: File): Promise<File> {
  return file;
}

export async function uploadToWebsiteConfig(
  file: File,
  path: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Validate file before upload
  const validation = await validateFileBeforeUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'File validation failed');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  let fileToUpload = file;

  if (opts.compress && file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file, opts);
    } catch (error) {
      console.warn('Image compression failed, uploading original', error);
    }
  }

  const { data, error } = await supabase.storage
    .from('websiteconfig')
    .upload(path, fileToUpload, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('websiteconfig')
    .getPublicUrl(data.path);

  return {
    url: urlData.publicUrl,
    path: data.path,
    publicUrl: urlData.publicUrl,
  };
}

export async function uploadToUserMedia(
  file: File,
  userId: string,
  folder: string,
  fileName: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  // Validate file before upload
  const validation = await validateFileBeforeUpload(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'File validation failed');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  let fileToUpload = file;

  if (opts.compress) {
    try {
      if (file.type.startsWith('image/')) {
        fileToUpload = await compressImage(file, opts);
      } else if (file.type.startsWith('video/')) {
        fileToUpload = await compressVideo(file);
      } else if (file.type.startsWith('audio/')) {
        fileToUpload = await compressAudio(file);
      }
    } catch (error) {
      console.warn('Compression failed, uploading original', error);
    }
  }

  const path = `${userId}/${folder}/${fileName}`;

  const { data, error } = await supabase.storage
    .from('user-media')
    .upload(path, fileToUpload, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) throw error;

  return {
    url: `user-media:${data.path}`,
    path: data.path,
    publicUrl: `user-media:${data.path}`,
  };
}

export async function resolveStorageUrl(storageReference: string): Promise<string> {
  if (!storageReference) return '';

  if (storageReference.startsWith('http://') || storageReference.startsWith('https://')) {
    return storageReference;
  }

  if (storageReference.startsWith('websiteconfig:')) {
    const path = storageReference.replace('websiteconfig:', '');
    return getWebsiteAsset(path);
  }

  if (storageReference.startsWith('user-media:')) {
    const path = storageReference.replace('user-media:', '');
    const { data } = supabase.storage.from('user-media').getPublicUrl(path);
    return data.publicUrl;
  }

  if (storageReference.includes('/storage/v1/object/public/')) {
    const match = storageReference.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (match) {
      const [, bucket, path] = match;
      if (bucket === 'websiteconfig') {
        return getWebsiteAsset(path);
      } else if (bucket === 'user-media' || bucket === 'users-medias') {
        const { data } = supabase.storage.from('user-media').getPublicUrl(path);
        return data.publicUrl;
      }
    }
  }

  return storageReference;
}

export async function getSignedUrl(
  bucket: 'user-media' | 'websiteconfig',
  path: string,
  expiresIn: number = 3600
): Promise<string> {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteFile(
  bucket: 'user-media' | 'websiteconfig',
  path: string
): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function isBase64(str: string): boolean {
  if (!str) return false;
  return str.startsWith('data:') || /^[A-Za-z0-9+/=]+$/.test(str);
}

export async function base64ToFile(
  base64: string,
  fileName: string
): Promise<File> {
  const response = await fetch(base64);
  const blob = await response.blob();
  return new File([blob], fileName, { type: blob.type });
}

export async function migrateBase64ToStorage(
  base64Data: string,
  userId: string,
  folder: string,
  fileName: string,
  options?: UploadOptions
): Promise<UploadResult | null> {
  if (!base64Data || !isBase64(base64Data)) return null;

  try {
    const file = await base64ToFile(base64Data, fileName);
    return await uploadToUserMedia(file, userId, folder, fileName, options);
  } catch (error) {
    console.error('Failed to migrate base64 to storage:', error);
    return null;
  }
}

export function getStoragePath(url: string): string | null {
  if (!url) return null;

  const patterns = [
    /\/storage\/v1\/object\/public\/([^/]+)\/(.+)/,
    /\/storage\/v1\/object\/sign\/([^/]+)\/(.+)\?/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[2];
    }
  }

  return null;
}

export function getPublicUrl(bucket: string, path: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

export async function resolveStorageUrlsBulk(
  references: string[],
  expiresIn: number = 3600
): Promise<Record<string, string>> {
  if (references.length === 0) return {};

  const filteredRefs = references.filter(Boolean);
  const uniqueRefs = Array.from(new Set(filteredRefs));

  const response = await fetch('/api/storage/resolve-urls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      references: uniqueRefs,
      expiresIn,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve storage URLs: ${response.statusText}`);
  }

  const result = await response.json();
  return result.urls || {};
}
