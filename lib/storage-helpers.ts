import { supabase } from './supabase';

export interface StoragePathConfig {
  userId: string;
  postId: string;
  fileName: string;
}

export interface SignedUploadResult {
  signedUrl: string;
  objectPath: string;
  token: string;
}

export interface SignedReadResult {
  signedUrl: string;
}

export function makeUserMediaPath(userId: string, postId: string, fileName: string): string {
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/posts/${postId}/${cleanFileName}`;
}

export function makeStorageReference(path: string): string {
  return `user-media:${path}`;
}

export function parseStorageReference(reference: string): { bucket: string; path: string } | null {
  if (!reference) return null;

  if (reference.startsWith('user-media:')) {
    return {
      bucket: 'user-media',
      path: reference.replace('user-media:', ''),
    };
  }

  if (reference.startsWith('websiteconfig:')) {
    return {
      bucket: 'websiteconfig',
      path: reference.replace('websiteconfig:', ''),
    };
  }

  return null;
}

export async function createSignedReadUrl(
  objectPath: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const { data } = supabase.storage.from('user-media').getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function resolveMediaReference(reference: string): Promise<string> {
  if (!reference) return '';

  if (reference.startsWith('http://') || reference.startsWith('https://')) {
    return reference;
  }

  const parsed = parseStorageReference(reference);
  if (!parsed) return reference;

  if (parsed.bucket === 'websiteconfig') {
    const { data } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path);
    return data.publicUrl;
  }

  if (parsed.bucket === 'user-media') {
    return await createSignedReadUrl(parsed.path, 3600);
  }

  return reference;
}

export function validateNoBlob(value: any): void {
  if (!value) return;

  const str = String(value);

  if (str.startsWith('data:')) {
    throw new Error('Base64 data URIs are not allowed. Please use storage upload flow.');
  }

  if (str.startsWith('blob:')) {
    throw new Error('Blob URLs are not allowed. Please use storage upload flow.');
  }

  if (str.length > 10000) {
    throw new Error('Suspiciously long URL detected. Please use storage upload flow.');
  }
}

export function assertStorageReference(value: string | null | undefined): void {
  if (!value) return;

  validateNoBlob(value);

  if (!value.startsWith('user-media:') &&
      !value.startsWith('websiteconfig:') &&
      !value.startsWith('http://') &&
      !value.startsWith('https://')) {
    throw new Error('Media must be a valid storage reference (user-media:path or websiteconfig:path) or external URL');
  }
}
