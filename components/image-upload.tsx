"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadToUserMedia } from '@/lib/storage';
import { useAuth } from '@/lib/auth-context';
import { compressImage, getCompressionSettings } from '@/lib/compression';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
}

export function ImageUpload({ value, onChange, folder = 'avatars' }: ImageUploadProps) {
  const { user } = useAuth();
  const [preview, setPreview] = useState(value || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a JPG, PNG, or WebP image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }

    setUploading(true);
    try {
      // Apply maximum compression based on file size
      const settings = getCompressionSettings(file.size);
      const compressedFile = await compressImage(file, settings);

      const originalSizeKB = (file.size / 1024).toFixed(0);
      const compressedSizeKB = (compressedFile.size / 1024).toFixed(0);
      console.log(`Image compressed: ${originalSizeKB}KB -> ${compressedSizeKB}KB (${((1 - compressedFile.size / file.size) * 100).toFixed(0)}% reduction)`);

      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const result = await uploadToUserMedia(compressedFile, user.id, folder, fileName, {
        compress: false, // Already compressed with aggressive settings
      });

      setPreview(result.url);
      onChange(result.url);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
          {preview ? (
            <div className="relative w-full h-full">
              <Image src={preview} alt="Preview" fill className="object-cover" />
            </div>
          ) : (
            <Upload className="h-12 w-12 text-gray-400" />
          )}
        </div>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        id="image-upload"
      />

      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Processing...' : preview ? 'Change Photo' : 'Upload Photo'}
      </Button>

      <p className="text-xs text-gray-500 text-center">
        JPG, PNG or WebP. Max 10MB. Images are automatically compressed.
      </p>
    </div>
  );
}
