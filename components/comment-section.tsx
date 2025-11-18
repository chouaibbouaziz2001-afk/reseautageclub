"use client";

import { useState, useEffect, KeyboardEvent } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Heart, MessageCircle, AtSign, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MentionText } from '@/components/mention-text';
import { StorageAvatar } from '@/components/storage-avatar';
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

interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_comment_id: string | null;
  likes_count: number;
  replies_count: number;
  created_at: string;
  author?: {
    full_name: string;
    avatar_url: string | null;
  };
  is_liked?: boolean;
  replies?: Comment[];
  mentioned_users?: string[];
}

interface CommentSectionProps {
  postId: string;
  onCommentAdded?: () => void;
}

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export function CommentSection({ postId, onCommentAdded }: CommentSectionProps) {
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          author:profiles!post_comments_author_id_fkey(full_name, avatar_url)
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const commentsWithLikes = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: likeData } = await supabase
            .from('comment_likes')
            .select('id')
            .eq('comment_id', comment.id)
            .eq('user_id', user?.id || '')
            .maybeSingle();

          const { data: mentionData } = await supabase
            .from('comment_mentions')
            .select('mentioned_user_id')
            .eq('comment_id', comment.id);

          const { data: replies } = await supabase
            .from('post_comments')
            .select(`
              *,
              author:profiles!post_comments_author_id_fkey(full_name, avatar_url)
            `)
            .eq('parent_comment_id', comment.id)
            .order('created_at', { ascending: true });

          const repliesWithLikes = await Promise.all(
            (replies || []).map(async (reply) => {
              const { data: replyLikeData } = await supabase
                .from('comment_likes')
                .select('id')
                .eq('comment_id', reply.id)
                .eq('user_id', user?.id || '')
                .maybeSingle();

              const { data: replyMentionData } = await supabase
                .from('comment_mentions')
                .select('mentioned_user_id')
                .eq('comment_id', reply.id);

              return {
                ...reply,
                is_liked: !!replyLikeData,
                mentioned_users: replyMentionData?.map(m => m.mentioned_user_id) || [],
              };
            })
          );

          return {
            ...comment,
            is_liked: !!likeData,
            replies: repliesWithLikes,
            mentioned_users: mentionData?.map(m => m.mentioned_user_id) || [],
          };
        })
      );

      setComments(commentsWithLikes);
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };

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
    loadComments();

    console.log('[CommentSection] Setting up realtime subscription for post:', postId);

    const subscription = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          console.log('[CommentSection] New comment:', payload.new);

          // Fetch complete comment with author info
          const { data: newComment } = await supabase
            .from('post_comments')
            .select(`
              *,
              author:profiles!post_comments_author_id_fkey(full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newComment) {
            // Check if it's a reply or top-level comment
            if (newComment.parent_comment_id) {
              // It's a reply - update the parent comment's replies
              setComments((prev) =>
                prev.map((comment) =>
                  comment.id === newComment.parent_comment_id
                    ? {
                        ...comment,
                        replies: [...(comment.replies || []), { ...newComment, is_liked: false, replies: [] }],
                        replies_count: (comment.replies_count || 0) + 1,
                      }
                    : comment
                )
              );
            } else {
              // It's a top-level comment
              const { data: mentionData } = await supabase
                .from('comment_mentions')
                .select('mentioned_user_id')
                .eq('comment_id', newComment.id);

              setComments((prev) => [
                ...prev,
                {
                  ...newComment,
                  is_liked: false,
                  replies: [],
                  mentioned_users: mentionData?.map((m) => m.mentioned_user_id) || [],
                },
              ]);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${postId}`,
        },
        (payload) => {
          console.log('[CommentSection] Comment deleted:', payload.old);

          // Remove comment or reply
          setComments((prev) =>
            prev
              .filter((comment) => comment.id !== payload.old.id)
              .map((comment) => ({
                ...comment,
                replies: comment.replies?.filter((reply) => reply.id !== payload.old.id),
              }))
          );
        }
      )
      .subscribe();

    return () => {
      console.log('[CommentSection] Cleaning up realtime subscription');
      supabase.removeChannel(subscription);
    };
  }, [postId, user?.id]);

  useEffect(() => {
    const lastWord = commentText.slice(0, cursorPosition).split(/\s/).pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionSearch(lastWord.slice(1));
      setShowMentions(true);
      searchUsers(lastWord.slice(1));
    } else {
      setShowMentions(false);
      setMentionSearch('');
    }
  }, [commentText, cursorPosition]);

  const handleTextChange = (value: string, cursorPos: number) => {
    setCommentText(value);
    setCursorPosition(cursorPos);
  };

  const insertMention = (userName: string, userId: string) => {
    const beforeCursor = commentText.slice(0, cursorPosition);
    const afterCursor = commentText.slice(cursorPosition);
    const words = beforeCursor.split(/\s/);
    words[words.length - 1] = `@${userName}`;
    const newText = words.join(' ') + ' ' + afterCursor;
    setCommentText(newText);
    setShowMentions(false);
  };

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_.\-]+(?:\s+[a-zA-Z0-9_.\-]+)*)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1].trim());
    }
    return mentions;
  };

  const handleSubmit = async (parentCommentId: string | null = null) => {
    if (!commentText.trim() || !user || !profile) return;

    setSubmitting(true);
    try {
      const { notificationHelpers } = await import('@/lib/notifications');

      const { data: newComment, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          author_id: user.id,
          content: commentText.trim(),
          parent_comment_id: parentCommentId,
        })
        .select()
        .single();

      if (error) throw error;

      // Get post author to send notification
      const { data: post } = await supabase
        .from('posts')
        .select('author_id')
        .eq('id', postId)
        .maybeSingle();

      // Send comment notification to post author (if not commenting on own post)
      if (post && post.author_id !== user.id) {
        await notificationHelpers.postComment(
          user.id,
          post.author_id,
          postId,
          profile.fullName
        );
      }

      // Handle mentions
      const mentions = extractMentions(commentText);
      if (mentions.length > 0) {
        // Fetch all profiles and do case-insensitive matching
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, full_name');

        // Match mentions case-insensitively
        const matchedUsers = allProfiles?.filter(profile =>
          mentions.some(mention =>
            mention.toLowerCase() === profile.full_name.toLowerCase()
          )
        ) || [];

        const { data: _unused } = matchedUsers.length > 0 ? { data: matchedUsers } : { data: null };

        if (matchedUsers && matchedUsers.length > 0) {
          await supabase.from('comment_mentions').insert(
            matchedUsers.map((u) => ({
              comment_id: newComment.id,
              mentioned_user_id: u.id,
              mentioned_by_user_id: user.id,
            }))
          );

          // Send mention notifications
          for (const mentionedUser of matchedUsers) {
            if (mentionedUser.id !== user.id) {
              await notificationHelpers.commentMention(
                user.id,
                mentionedUser.id,
                postId,
                profile.fullName
              );
            }
          }
        }
      }

      setCommentText('');
      setReplyingTo(null);
      // Don't call loadComments() or onCommentAdded() - rely on realtime updates
    } catch (error) {
      console.error('Failed to add comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (commentId: string, isLiked: boolean) => {
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        await supabase.rpc('decrement_comment_likes_count', {
          comment_id: commentId,
        });
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: user.id,
        });

        await supabase.rpc('increment_comment_likes_count', {
          comment_id: commentId,
        });
      }

      loadComments();
    } catch (error) {
      console.error('Failed to toggle like:', error);
    }
  };

  const handleDelete = async () => {
    if (!commentToDelete) return;

    try {
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentToDelete);

      if (error) throw error;

      toast({
        title: 'Comment deleted',
        description: 'Your comment has been removed',
      });
    } catch (error) {
      console.error('Failed to delete comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete comment',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setCommentToDelete(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(replyingTo);
    }
    if (e.key === 'Escape') {
      setCommentText('');
      setReplyingTo(null);
    }
  };

  const renderComment = (comment: Comment, isReply: boolean = false) => (
    <div key={comment.id} className={isReply ? 'ml-10' : ''}>
      <div className="flex gap-2">
        <StorageAvatar
          src={comment.author?.avatar_url || undefined}
          alt={comment.author?.full_name || 'User'}
          fallback={comment.author?.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
          className="h-8 w-8 flex-shrink-0"
          clickable={false}
        />
        <div className="flex-1 min-w-0">
          <div className="bg-gray-800 rounded-2xl px-4 py-2.5 border border-gray-700">
            <p className="font-bold text-sm text-gray-100 capitalize">{comment.author?.full_name}</p>
            <p className="text-sm text-gray-300 mt-0.5">
              <MentionText content={comment.content} mentionedUserIds={comment.mentioned_users} />
            </p>
          </div>
          <div className="flex items-center gap-4 mt-1.5 ml-4">
            <button
              onClick={() => handleLike(comment.id, comment.is_liked || false)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400 transition-colors"
            >
              <Heart
                className={`h-3.5 w-3.5 ${comment.is_liked ? 'fill-amber-400 text-amber-400' : ''}`}
              />
              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
            </button>
            <button
              onClick={() => setReplyingTo(comment.id)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Reply
            </button>
            {user?.id === comment.author_id && (
              <button
                onClick={() => {
                  setCommentToDelete(comment.id);
                  setDeleteDialogOpen(true);
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          {replyingTo === comment.id && (
            <div className="mt-2 ml-4">
              <CommentInput
                value={commentText}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                onSubmit={() => handleSubmit(comment.id)}
                onCancel={() => setReplyingTo(null)}
                submitting={submitting}
                placeholder={`Reply to ${comment.author?.full_name}...`}
                showMentions={showMentions}
                users={users}
                onSelectUser={insertMention}
              />
            </div>
          )}
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-3">
          {comment.replies.map((reply) => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pt-4 border-t border-gray-800 mt-3">
      <div className="flex gap-2 items-start">
        <StorageAvatar
          src={user?.avatarUrl}
          alt={user?.fullName || 'You'}
          fallback={user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'U'}
          className="h-8 w-8 flex-shrink-0"
          clickable={false}
        />
        <div className="flex-1">
          <CommentInput
            value={commentText}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onSubmit={() => handleSubmit(null)}
            submitting={submitting}
            placeholder="Write a comment... (Use @ to mention someone)"
            showMentions={showMentions}
            users={users}
            onSelectUser={insertMention}
          />
        </div>
      </div>

      {comments.length > 0 && (
        <div className="space-y-4">
          {comments.map((comment) => renderComment(comment))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-gray-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-100">Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              This action cannot be undone. This will permanently delete your comment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-100 hover:bg-gray-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface CommentInputProps {
  value: string;
  onChange: (value: string, cursorPos: number) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitting: boolean;
  placeholder: string;
  showMentions: boolean;
  users: UserProfile[];
  onSelectUser: (userName: string, userId: string) => void;
}

function CommentInput({
  value,
  onChange,
  onKeyDown,
  onSubmit,
  onCancel,
  submitting,
  placeholder,
  showMentions,
  users,
  onSelectUser,
}: CommentInputProps) {
  return (
    <div className="space-y-2">
      <div className="relative">
        <Textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value, e.target.selectionStart)}
          onKeyDown={onKeyDown}
          disabled={submitting}
          className="min-h-[80px] bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500 focus:border-amber-500 focus:ring-amber-500/20 resize-none"
          onClick={(e) => onChange(value, e.currentTarget.selectionStart)}
        />
        {showMentions && users.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
            <ScrollArea className="max-h-48">
              <div className="p-2">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => onSelectUser(user.full_name, user.id)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-800 transition-colors text-left"
                  >
                    <StorageAvatar
                      src={user.avatar_url || undefined}
                      alt={user.full_name}
                      fallback={user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      className="h-6 w-6"
                      clickable={false}
                    />
                    <span className="text-gray-100 capitalize">{user.full_name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-100"
          >
            Cancel
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          onClick={onSubmit}
          disabled={!value.trim() || submitting}
          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold"
        >
          {submitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
}

export default CommentSection;
