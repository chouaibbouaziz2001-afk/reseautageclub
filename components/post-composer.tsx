"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image as ImageIcon, Video, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { useLoading } from '@/lib/loading-context';
import { StorageAvatar } from '@/components/storage-avatar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { uploadToUserMedia } from '@/lib/storage';
import { assertStorageReference } from '@/lib/storage-helpers';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface PostComposerProps {
  onPostCreated: () => void;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { startLoading, stopLoading } = useLoading();
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [showMentions, setShowMentions] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);

  const searchUsers = async (search: string) => {
    if (!search) {
      setUsers([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .ilike('full_name', `%${search}%`)
        .limit(5);

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
      setUsers([]);
    }
  };

  useEffect(() => {
    const lastWord = content.slice(0, cursorPosition).split(/\s/).pop() || '';
    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      searchUsers(lastWord.slice(1));
    } else {
      setShowMentions(false);
    }
  }, [content, cursorPosition]);

  const handleTextChange = (value: string, cursorPos: number) => {
    setContent(value);
    setCursorPosition(cursorPos);
  };

  const insertMention = (userName: string) => {
    const beforeCursor = content.slice(0, cursorPosition);
    const afterCursor = content.slice(cursorPosition);
    const words = beforeCursor.split(/\s/);
    words[words.length - 1] = `@${userName}`;
    const newText = words.join(' ') + ' ' + afterCursor;
    setContent(newText);
    setShowMentions(false);
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1].trim());
    }
    return mentions;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !user) return;

    if (images.length + files.length > 4) {
      toast.error('Maximum 4 images allowed per post');
      return;
    }

    setUploading(true);
    setUploadProgress('Compressing images...');
    try {
      const uploadedUrls = await Promise.all(
        files.map(async (file, index) => {
          if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
            throw new Error('Please upload JPG, PNG, WebP, or GIF images');
          }
          if (file.size > 10 * 1024 * 1024) {
            throw new Error('File size must be less than 10MB');
          }

          // Apply maximum compression
          setUploadProgress(`Compressing image ${index + 1}/${files.length}...`);
          const settings = getCompressionSettings(file.size);
          const compressedFile = await compressImage(file, settings);

          const originalSizeKB = (file.size / 1024).toFixed(0);
          const compressedSizeKB = (compressedFile.size / 1024).toFixed(0);
          console.log(`Image ${index + 1}: ${originalSizeKB}KB -> ${compressedSizeKB}KB`);

          setUploadProgress(`Uploading image ${index + 1}/${files.length}...`);
          const fileName = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}.jpg`;
          const result = await uploadToUserMedia(compressedFile, user.id, 'posts', fileName, {
            compress: false, // Already compressed
          });
          return result.url;
        })
      );
      setImages([...images, ...uploadedUrls]);
      setMediaType('image');
      toast.success('Images uploaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('video/')) {
      toast.error('Please upload a video file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video size must be less than 50MB');
      return;
    }

    setUploading(true);
    setUploadProgress('Uploading video...');
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const result = await uploadToUserMedia(file, user.id, 'posts', fileName, {
        compress: false,
      });
      setVideo(result.url);
      setMediaType('video');
      setImages([]);
      toast.success('Video uploaded successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload video');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (newImages.length === 0) {
      setMediaType(null);
    }
  };

  const removeVideo = () => {
    setVideo(null);
    setMediaType(null);
  };

  const handlePost = async () => {
    if (!content.trim() && images.length === 0 && !video) {
      toast.error('Please add some content, images, or a video');
      return;
    }

    if (content.length > 1000) {
      toast.error('Post content must be 1000 characters or less');
      return;
    }

    if (!executeRecaptcha) {
      toast.error('Security verification not ready. Please try again.');
      return;
    }

    setPosting(true);
    startLoading('Creating post...');
    try {
      const recaptchaToken = await executeRecaptcha('create_post');

      const verifyResponse = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        toast.error(verifyData.error || 'Security verification failed. Please try again.');
        setPosting(false);
        return;
      }

      const imageUrl = images.length > 0 ? images[0] : null;

      try {
        assertStorageReference(imageUrl);
        assertStorageReference(video);
      } catch (validationError: any) {
        toast.error(validationError.message);
        setPosting(false);
        return;
      }

      const { data: newPost, error } = await supabase
        .from('posts')
        .insert({
          author_id: user!.id,
          content: content.trim(),
          image_url: imageUrl,
          video_url: video,
          media_type: mediaType,
          likes_count: 0,
          comments_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const mentions = extractMentions(content);
      if (mentions.length > 0) {
        const { data: matchedUsers } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('full_name', mentions);

        if (matchedUsers && matchedUsers.length > 0) {
          await supabase.from('post_mentions').insert(
            matchedUsers.map((u) => ({
              post_id: newPost.id,
              mentioned_user_id: u.id,
              mentioned_by_user_id: user!.id,
            }))
          );
        }
      }

      setContent('');
      setImages([]);
      setVideo(null);
      setMediaType(null);

      toast.success('Post created successfully!');

      // Call the callback to refresh the feed immediately
      onPostCreated();
    } catch (error) {
      console.error('Failed to create post:', error);
      toast.error('Failed to create post');
      stopLoading();
    } finally {
      setPosting(false);
      stopLoading();
    }
  };

  if (!user || !profile) return null;

  const isContentValid = content.trim().length > 0 || images.length > 0 || video !== null;
  const isNearLimit = content.length >= 950;

  return (
    <Card className="mb-3 sm:mb-4 md:mb-6 bg-gray-900/60 border-gray-800 overflow-hidden">
      <CardContent className="p-3 sm:p-4 md:p-6">
        <div className="flex gap-2 sm:gap-3">
          <StorageAvatar
            src={user.avatarUrl}
            alt={user.fullName}
            fallback={user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2)}
            className="h-10 w-10 sm:h-12 sm:w-12 border-2 border-amber-500 flex-shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-2 sm:space-y-3 overflow-hidden">
            <div className="relative">
              <Textarea
                placeholder="What's on your mind? (Use @ to mention someone)"
                value={content}
                onChange={(e) => handleTextChange(e.target.value, e.target.selectionStart)}
                onClick={(e) => handleTextChange(content, e.currentTarget.selectionStart)}
                className="min-h-[80px] sm:min-h-[100px] resize-none border-0 focus-visible:ring-0 p-0 bg-transparent text-sm sm:text-base text-gray-100 placeholder:text-gray-500 w-full"
                maxLength={1000}
                disabled={posting}
              />
              {showMentions && users.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full max-w-xs bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
                  <ScrollArea className="max-h-48">
                    <div className="p-2">
                      {users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => insertMention(u.full_name)}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-800 transition-colors text-left"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.avatar_url || undefined} />
                            <AvatarFallback className="bg-amber-500/20 text-amber-400 text-xs">
                              {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-100 capitalize truncate">{u.full_name}</span>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
            <div className={`text-xs ${isNearLimit ? 'text-red-400 font-semibold' : 'text-gray-500'}`}>
              {content.length}/1000
            </div>

            {video && (
              <div className="relative group w-full overflow-hidden">
                <video
                  src={video}
                  controls
                  className="w-full max-h-64 sm:max-h-96 rounded-lg bg-black"
                />
                <button
                  onClick={removeVideo}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {images.length > 0 && !video && (
              <div className={`grid gap-2 sm:gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} w-full overflow-hidden`}>
                {images.map((image, index) => (
                  <div key={index} className="relative group w-full overflow-hidden h-40 sm:h-48">
                    <Image
                      src={image}
                      alt={`Upload ${index + 1}`}
                      fill
                      className="object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-2 sm:pt-3 border-t border-gray-800">
              <div className="flex gap-1 sm:gap-2 overflow-x-auto">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  id="post-images"
                  disabled={images.length >= 4 || uploading || posting || video !== null}
                />
                <label htmlFor="post-images">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={images.length >= 4 || uploading || posting || video !== null}
                    className="cursor-pointer text-gray-300 hover:text-amber-400 hover:bg-gray-800 flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('post-images')?.click();
                    }}
                  >
                    <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="truncate">{uploading ? uploadProgress || 'Uploading...' : `Image (${images.length}/4)`}</span>
                  </Button>
                </label>

                <input
                  type="file"
                  accept="video/mp4,video/webm,video/ogg,video/quicktime"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="post-video"
                  disabled={uploading || posting || images.length > 0 || video !== null}
                />
                <label htmlFor="post-video">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploading || posting || images.length > 0 || video !== null}
                    className="cursor-pointer text-gray-300 hover:text-amber-400 hover:bg-gray-800 flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3"
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById('post-video')?.click();
                    }}
                  >
                    <Video className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="truncate">{video ? 'Video added' : 'Video'}</span>
                  </Button>
                </label>
              </div>

              <Button
                onClick={handlePost}
                disabled={posting || !isContentValid || !profile.profileCompleted}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold shadow-lg transition-all w-full sm:w-auto text-sm"
              >
                {posting ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    <span className="truncate">Posting...</span>
                  </>
                ) : (
                  <span className="truncate">Post</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default PostComposer;
