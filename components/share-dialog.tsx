"use client";

import { useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import type { Post } from '@/lib/types';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: Post;
  onShare: (opinion: string) => Promise<void>;
}

export function ShareDialog({ open, onOpenChange, post, onShare }: ShareDialogProps) {
  const { user } = useAuth();
  const [opinion, setOpinion] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await onShare(opinion);
      setOpinion('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to share:', error);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Share Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user?.avatarUrl} />
              <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                {user?.fullName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-semibold text-gray-900">{user?.fullName || 'User'}</p>
              <Textarea
                value={opinion}
                onChange={(e) => setOpinion(e.target.value)}
                placeholder="Add your thoughts about this post..."
                className="mt-2 min-h-[100px] resize-none"
              />
            </div>
          </div>

          <Card className="bg-gray-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.authorPhoto} />
                  <AvatarFallback className="bg-blue-100 text-blue-600 font-semibold">
                    {(post.authorName || 'User').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{post.authorName || 'User'}</p>
                  {post.content && (
                    <p className="text-gray-800 mt-2 whitespace-pre-wrap break-words line-clamp-3">
                      {post.content}
                    </p>
                  )}
                  {post.images.length > 0 && (
                    <div className="mt-2">
                      <div className="relative w-full h-32">
                        <Image
                          src={post.images[0]}
                          alt="Post preview"
                          fill
                          className="object-cover rounded-lg"
                        />
                      </div>
                      {post.images.length > 1 && (
                        <p className="text-xs text-gray-500 mt-1">+{post.images.length - 1} more</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing}
            >
              {isSharing ? 'Sharing...' : 'Share to Feed'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
