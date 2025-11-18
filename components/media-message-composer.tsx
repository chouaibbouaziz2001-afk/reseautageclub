"use client";

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  Mic,
  X,
  Loader2,
  Play,
  Pause,
  Check,
  Upload,
} from 'lucide-react';
import { AudioRecorder } from '@/components/audio-recorder';
import { useAuth } from '@/lib/auth-context';
import { uploadToUserMedia } from '@/lib/storage';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import { toast } from 'sonner';

interface MediaMessageComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendMedia: (mediaUrl: string, mediaType: 'image' | 'video' | 'audio') => Promise<void>;
  disabled?: boolean;
}

type MediaPreview = {
  type: 'image' | 'video' | 'audio';
  file: File;
  url: string;
};

export function MediaMessageComposer({
  onSendText,
  onSendMedia,
  disabled = false,
}: MediaMessageComposerProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  const handleSendText = async () => {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await onSendText(message.trim());
      setMessage('');
    } catch (error) {
      console.error('Error sending text:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a JPG, PNG, WebP, or GIF image');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaPreview({ type: 'image', file, url });
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select an MP4, WebM, or MOV video');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be less than 50MB');
      return;
    }

    const url = URL.createObjectURL(file);
    setMediaPreview({ type: 'video', file, url });
  };

  const handleAudioRecorded = async (audioBlob: Blob) => {
    const file = new File([audioBlob], `audio-${Date.now()}.webm`, {
      type: 'audio/webm',
    });

    const url = URL.createObjectURL(file);
    setMediaPreview({ type: 'audio', file, url });
    setShowAudioRecorder(false);
  };

  const handleCancelMedia = () => {
    if (mediaPreview?.url) {
      URL.revokeObjectURL(mediaPreview.url);
    }
    setMediaPreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const handleSendMedia = async () => {
    if (!mediaPreview || !user) return;

    setUploading(true);
    setSending(true);

    try {
      let fileToUpload = mediaPreview.file;

      if (mediaPreview.type === 'image') {
        const settings = getCompressionSettings(mediaPreview.file.size);
        fileToUpload = await compressImage(mediaPreview.file, settings);

        const originalSizeKB = (mediaPreview.file.size / 1024).toFixed(0);
        const compressedSizeKB = (fileToUpload.size / 1024).toFixed(0);
        console.log(
          `Image compressed: ${originalSizeKB}KB -> ${compressedSizeKB}KB (${(
            (1 - fileToUpload.size / mediaPreview.file.size) *
            100
          ).toFixed(0)}% reduction)`
        );
      }

      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${
        mediaPreview.type === 'image' ? 'jpg' : mediaPreview.type === 'video' ? 'mp4' : 'webm'
      }`;

      const folder = mediaPreview.type === 'image'
        ? 'messages/images'
        : mediaPreview.type === 'video'
        ? 'messages/videos'
        : 'messages/audio';

      const result = await uploadToUserMedia(fileToUpload, user.id, folder, fileName, {
        compress: false,
      });

      await onSendMedia(result.url, mediaPreview.type);

      handleCancelMedia();
      toast.success(`${mediaPreview.type.charAt(0).toUpperCase() + mediaPreview.type.slice(1)} sent!`);
    } catch (error) {
      console.error('Error uploading media:', error);
      toast.error('Failed to send media');
    } finally {
      setUploading(false);
      setSending(false);
    }
  };

  const toggleVideoPreview = () => {
    if (!videoPreviewRef.current) return;

    if (isPlayingPreview) {
      videoPreviewRef.current.pause();
    } else {
      videoPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  const toggleAudioPreview = () => {
    if (!audioPreviewRef.current) return;

    if (isPlayingPreview) {
      audioPreviewRef.current.pause();
    } else {
      audioPreviewRef.current.play();
    }
    setIsPlayingPreview(!isPlayingPreview);
  };

  if (showAudioRecorder) {
    return (
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900">
        <AudioRecorder
          onRecordingComplete={handleAudioRecorded}
          onCancel={() => setShowAudioRecorder(false)}
        />
      </div>
    );
  }

  if (mediaPreview) {
    return (
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300 font-medium">
            Preview {mediaPreview.type}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancelMedia}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-100"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
          {mediaPreview.type === 'image' && (
            <div className="relative w-full h-[300px]">
              <Image
                src={mediaPreview.url}
                alt="Preview"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          {mediaPreview.type === 'video' && (
            <div className="relative">
              <video
                ref={videoPreviewRef}
                src={mediaPreview.url}
                className="w-full max-h-[300px] object-contain"
                onPlay={() => setIsPlayingPreview(true)}
                onPause={() => setIsPlayingPreview(false)}
                onEnded={() => setIsPlayingPreview(false)}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleVideoPreview}
                className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-black/50 hover:bg-black/70 text-white"
              >
                {isPlayingPreview ? (
                  <Pause className="h-8 w-8" />
                ) : (
                  <Play className="h-8 w-8 ml-1" />
                )}
              </Button>
            </div>
          )}

          {mediaPreview.type === 'audio' && (
            <div className="p-6 flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleAudioPreview}
                className="h-12 w-12 rounded-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isPlayingPreview ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-1" />
                )}
              </Button>
              <audio
                ref={audioPreviewRef}
                src={mediaPreview.url}
                onPlay={() => setIsPlayingPreview(true)}
                onPause={() => setIsPlayingPreview(false)}
                onEnded={() => setIsPlayingPreview(false)}
                className="flex-1"
              />
              <div className="flex-1">
                <p className="text-gray-300 text-sm">Audio recording</p>
                <p className="text-gray-500 text-xs">
                  {(mediaPreview.file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !uploading) {
                e.preventDefault();
                handleSendMedia();
              }
            }}
            placeholder="Add a caption (optional)..."
            className="flex-1 bg-gray-800 border-gray-700 text-white"
            disabled={uploading}
          />
          <Button
            onClick={handleSendMedia}
            disabled={uploading}
            className="bg-amber-600 hover:bg-amber-700 min-w-[44px] min-h-[44px]"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {uploading && (
          <div className="flex items-center gap-2 text-amber-500 text-sm">
            <Upload className="h-4 w-4 animate-bounce" />
            <span>Uploading {mediaPreview.type}...</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900">
      <div className="flex items-center gap-2">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageSelect}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleVideoSelect}
          className="hidden"
        />

        <Button
          variant="ghost"
          size="icon"
          onClick={() => imageInputRef.current?.click()}
          disabled={disabled || sending}
          className="text-gray-400 hover:text-amber-500 min-w-[44px] min-h-[44px]"
          title="Send image"
        >
          <ImageIcon className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => videoInputRef.current?.click()}
          disabled={disabled || sending}
          className="text-gray-400 hover:text-amber-500 min-w-[44px] min-h-[44px]"
          title="Send video"
        >
          <VideoIcon className="h-5 w-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowAudioRecorder(true)}
          disabled={disabled || sending}
          className="text-gray-400 hover:text-amber-500 min-w-[44px] min-h-[44px]"
          title="Record audio"
        >
          <Mic className="h-5 w-5" />
        </Button>

        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendText();
            }
          }}
          placeholder="Type a message..."
          className="flex-1 bg-gray-800 border-gray-700 text-white"
          disabled={disabled || sending}
        />

        <Button
          onClick={handleSendText}
          disabled={!message.trim() || sending || disabled}
          className="bg-amber-600 hover:bg-amber-700 min-w-[44px] min-h-[44px]"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
