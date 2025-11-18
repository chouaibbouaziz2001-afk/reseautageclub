"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Heart, MessageCircle, Share2, MoreVertical, Trash2, Link as LinkIcon } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { useLoading } from '@/lib/loading-context';
import { CommentSection } from '@/components/comment-section';
import { ShareDialog } from '@/components/share-dialog';
import { StorageAvatar } from '@/components/storage-avatar';
import { MentionText } from '@/components/mention-text';
import { PostMedia } from '@/components/post-media';
import type { Post } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface PostCardProps {
  post: Post;
  onUpdate: () => void;
}

export function PostCard({ post, onUpdate }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [showComments, setShowComments] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments?.length || 0);
  const [shareCount, setShareCount] = useState(post.shareCount || 0);

  // Check if user has liked this post
  useEffect(() => {
    if (!user) return;

    const checkLikeStatus = async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', user.id)
        .maybeSingle();

      setIsLiked(!!data);
    };

    checkLikeStatus();
  }, [post.id, user?.id]);

  // Real-time subscription for post updates
  useEffect(() => {
    const { supabase } = require('@/lib/supabase');

    // Subscribe to post updates (likes, comments, shares count)
    const postSubscription = supabase
      .channel(`post-${post.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
          filter: `id=eq.${post.id}`,
        },
        (payload: any) => {
          console.log('[PostCard] Post updated:', payload.new);
          if (payload.new.likes_count !== undefined) {
            setLikesCount(payload.new.likes_count);
          }
          if (payload.new.comments_count !== undefined) {
            setCommentsCount(payload.new.comments_count);
          }
          if (payload.new.share_count !== undefined) {
            setShareCount(payload.new.share_count);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postSubscription);
    };
  }, [post.id]);

  const handleDoubleTapLike = async () => {
    console.log('[PostCard] handleDoubleTapLike called, user:', user?.id, 'isLiked:', isLiked, 'post:', post.id);

    if (!user) {
      console.log('[PostCard] No user, returning');
      return;
    }

    // If already liked, just show animation (don't unlike)
    if (isLiked) {
      console.log('[PostCard] Already liked, animation will show but not unliking');
      return;
    }

    try {
      const { supabase } = await import('@/lib/supabase');
      const { notificationHelpers } = await import('@/lib/notifications');

      console.log('[PostCard] Attempting to like post:', post.id, 'by user:', user.id);

      // Optimistically update UI
      setIsLiked(true);
      setLikesCount(prev => prev + 1);

      // Use upsert to handle case where like already exists
      const { data, error } = await supabase
        .from('post_likes')
        .upsert({
          post_id: post.id,
          user_id: user.id
        }, {
          onConflict: 'post_id,user_id',
          ignoreDuplicates: true
        })
        .select();

      if (error) {
        console.error('[PostCard] Failed to like:', error);
        console.error('[PostCard] Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Rollback on error
        setIsLiked(false);
        setLikesCount(prev => prev - 1);

        toast({
          title: 'Failed to like post',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        console.log('[PostCard] Successfully liked post, data:', data);

        // Send notification to post author (if not own post)
        if (post.authorId !== user.id) {
          console.log('[PostCard] Sending notification to post author');

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            await notificationHelpers.postLike(
              user.id,
              post.authorId,
              post.id,
              profile.full_name
            );
            console.log('[PostCard] Notification sent');
          }
        }
      }
    } catch (error) {
      console.error('[PostCard] Exception in double-tap like:', error);
      // Rollback on exception
      setIsLiked(false);
      setLikesCount(prev => prev - 1);
    }
  };

  const handleLike = async () => {
    if (!user) return;

    try {
      const { supabase } = await import('@/lib/supabase');
      const { notificationHelpers } = await import('@/lib/notifications');

      // Optimistic update
      const wasLiked = isLiked;
      setIsLiked(!isLiked);
      setLikesCount(prev => wasLiked ? prev - 1 : prev + 1);

      if (wasLiked) {
        // Unlike: Delete the like
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) {
          console.error('Failed to unlike:', error);
          // Rollback optimistic update
          setIsLiked(wasLiked);
          setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
        }
      } else {
        // Like: Insert the like
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: post.id,
            user_id: user.id
          });

        if (error) {
          console.error('Failed to like:', error);
          // Rollback optimistic update
          setIsLiked(wasLiked);
          setLikesCount(prev => wasLiked ? prev + 1 : prev - 1);
        } else {
          // Send notification if liking and not own post
          if (post.authorId !== user.id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle();

            if (profile) {
              await notificationHelpers.postLike(
                user.id,
                post.authorId,
                post.id,
                profile.full_name
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to delete posts',
        variant: 'destructive',
      });
      setShowDeleteDialog(false);
      return;
    }

    if (post.authorId !== user.id) {
      toast({
        title: 'Error',
        description: 'You can only delete your own posts',
        variant: 'destructive',
      });
      setShowDeleteDialog(false);
      return;
    }

    startLoading('Deleting post...');
    setShowDeleteDialog(false);

    try {
      const { supabase } = await import('@/lib/supabase');

      console.log('Deleting post:', { postId: post.id, authorId: post.authorId, userId: user.id });

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      console.log('Post deleted successfully');

      toast({
        title: 'Deleted',
        description: 'Post has been deleted successfully',
      });

      // Call onUpdate to refresh the feed immediately
      onUpdate();
      stopLoading();
    } catch (error: any) {
      console.error('Failed to delete post:', error);
      stopLoading();
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete post',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async (opinion: string) => {
    if (!user) return;

    try {
      const { notificationHelpers } = await import('@/lib/notifications');
      const { supabase } = await import('@/lib/supabase');

      const originalPostId = post.sharedPostId || post.id;
      const originalAuthorId = post.sharedPostId ? post.sharedPost?.authorId : post.authorId;

      // Insert the shared post
      const { error: shareError } = await supabase
        .from('posts')
        .insert({
          author_id: user.id,
          content: opinion,
          shared_post_id: originalPostId,
        });

      if (shareError) throw shareError;

      // Increment share count
      const { error: updateError } = await supabase.rpc('increment_share_count', {
        post_id: originalPostId,
      });

      if (updateError) {
        console.error('Error updating share count:', updateError);
      }

      // Send notification to original post author
      if (originalAuthorId && originalAuthorId !== user.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          await notificationHelpers.postShare(
            user.id,
            originalAuthorId,
            originalPostId,
            profile.full_name
          );
        }
      }

      toast({
        title: 'Shared!',
        description: 'Post has been shared to your feed',
      });
      // Don't call onUpdate() - rely on realtime updates
    } catch (error) {
      console.error('Failed to share post:', error);
      toast({
        title: 'Error',
        description: 'Failed to share post',
        variant: 'destructive',
      });
    }
  };

  const handleCopyLink = async () => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'post',
      id: post.id,
    });

    if (success) {
      toast({
        title: 'Link copied!',
        description: getCopySuccessMessage('post'),
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const isAuthor = user?.id === post.authorId;

  return (
    <Card className="bg-gray-900/60 border-gray-800 active:border-gray-700 sm:hover:border-gray-700 active:shadow-2xl sm:hover:shadow-2xl transition-all duration-200 overflow-visible" style={{ transform: 'none' }}>
      <CardContent className="p-4 sm:p-6 overflow-visible">
        <div className="flex items-start justify-between mb-3">
          <Link href={`/profile/${post.authorId}`} className="flex gap-2 sm:gap-3 active:opacity-80 sm:hover:opacity-80 transition-opacity min-w-0 flex-1">
            <StorageAvatar
              src={post.authorPhoto}
              alt={post.authorName}
              fallback={post.authorName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              className="h-12 w-12"
            />
            <div>
              <p className="font-semibold text-gray-100 hover:underline">{post.authorName}</p>
              <p className="text-sm text-gray-400">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </p>
            </div>
          </Link>

          <div className="relative">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-amber-400 hover:bg-gray-800 flex-shrink-0"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="bg-gray-900 border-gray-700 shadow-xl min-w-[180px]"
                sideOffset={5}
              >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyLink();
                }}
                className="text-gray-300 cursor-pointer hover:bg-gray-800 focus:bg-gray-800 focus:text-gray-100"
              >
                <LinkIcon className="mr-2 h-4 w-4" />
                Copy Link
              </DropdownMenuItem>
              {isAuthor && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteDialog(true);
                  }}
                  className="text-red-400 cursor-pointer hover:bg-red-500/20 focus:bg-red-500/20 focus:text-red-300"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>

        {post.content && (
          <p className="text-gray-200 mb-4 text-base leading-relaxed">
            <MentionText content={post.content} mentionedUserIds={post.taggedUsers} />
          </p>
        )}

        <PostMedia
          images={post.images}
          videoUrl={post.videoUrl}
          onDoubleTap={handleDoubleTapLike}
        />

        {post.sharedPostId && post.sharedPost && (
          <Card className="bg-gray-800/80 border-gray-700 mb-4">
            <CardContent className="p-3 sm:p-4">
              <Link
                href={`/profile/${post.sharedPost.authorId}`}
                className="flex items-start gap-3 mb-2 hover:opacity-80 transition-opacity"
              >
                <StorageAvatar
                  src={post.sharedPost.authorPhoto}
                  alt={post.sharedPost.authorName || 'User'}
                  fallback={(post.sharedPost.authorName || 'User').split(' ').map(n => n[0]).join('').slice(0, 2)}
                  className="h-10 w-10"
                />
                <div>
                  <p className="font-semibold text-gray-200 hover:underline">{post.sharedPost.authorName || 'User'}</p>
                  {post.sharedPost.createdAt && (
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(post.sharedPost.createdAt), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </Link>
              {post.sharedPost.content && (
                <p className="text-gray-300 mb-2">
                  <MentionText content={post.sharedPost.content} mentionedUserIds={post.sharedPost.taggedUsers} />
                </p>
              )}
              <PostMedia
                images={post.sharedPost.images || []}
                videoUrl={post.sharedPost.videoUrl}
                onDoubleTap={handleDoubleTapLike}
              />
            </CardContent>
          </Card>
        )}

        <div className="flex items-center gap-1 text-sm text-gray-400 mb-4 pt-3 border-t border-gray-800">
          {likesCount > 0 && (
            <span className="font-medium transition-all">{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>
          )}
          {likesCount > 0 && (commentsCount > 0 || shareCount > 0) && (
            <span className="mx-1">•</span>
          )}
          {commentsCount > 0 && (
            <span className="font-medium transition-all">{commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}</span>
          )}
          {commentsCount > 0 && shareCount > 0 && (
            <span className="mx-1">•</span>
          )}
          {shareCount > 0 && (
            <span className="font-medium transition-all">{shareCount} {shareCount === 1 ? 'share' : 'shares'}</span>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 pb-3 sm:pb-4 border-b border-gray-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={`flex-1 gap-1 sm:gap-2 font-medium transition-all tap-target h-10 sm:h-11 px-2 sm:px-4 ${
              isLiked
                ? 'text-red-400 active:text-red-300 sm:hover:text-red-300 active:bg-red-500/20 sm:hover:bg-red-500/20'
                : 'text-gray-300 active:text-amber-400 sm:hover:text-amber-400 active:bg-gray-800 sm:hover:bg-gray-800'
            }`}
          >
            <Heart className={`h-4 w-4 sm:h-5 sm:w-5 transition-all ${isLiked ? 'fill-red-400' : ''}`} />
            <span className="text-sm sm:text-base">Like</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
            className="flex-1 gap-1 sm:gap-2 text-gray-300 active:text-amber-400 sm:hover:text-amber-400 active:bg-gray-800 sm:hover:bg-gray-800 transition-all font-medium tap-target h-10 sm:h-11 px-2 sm:px-4"
          >
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base">Comment</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowShareDialog(true)}
            className="flex-1 gap-1 sm:gap-2 text-gray-300 active:text-amber-400 sm:hover:text-amber-400 active:bg-gray-800 sm:hover:bg-gray-800 transition-all font-medium tap-target h-10 sm:h-11 px-2 sm:px-4"
          >
            <Share2 className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base">Share</span>
          </Button>
        </div>

        {showComments && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            <CommentSection
              postId={post.id}
              onCommentAdded={onUpdate}
            />
          </div>
        )}
      </CardContent>

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        post={post.sharedPostId && post.sharedPost ? post.sharedPost : post}
        onShare={handleShare}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-gray-900 border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Delete Post</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700 border-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
