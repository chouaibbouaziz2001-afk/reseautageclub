"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserMinus, Loader2, Users } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { StorageAvatar } from './storage-avatar';

interface Follower {
  id: string;
  follower_id: string;
  following_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
    stage: string;
  };
}

interface FollowersListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  type: 'followers' | 'following';
  isOwnProfile: boolean;
}

export function FollowersListDialog({
  open,
  onOpenChange,
  userId,
  type,
  isOwnProfile,
}: FollowersListDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [unfollowing, setUnfollowing] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      loadFollowers();

      const followsChannel = supabase
        .channel(`follows-dialog-${userId}-${type}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'follows',
          },
          () => {
            loadFollowers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(followsChannel);
      };
    }
  }, [open, userId, type]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      let query = supabase.from('follows').select(`
        id,
        follower_id,
        following_id,
        profiles!${type === 'followers' ? 'follows_follower_id_fkey' : 'follows_following_id_fkey'}(id, full_name, avatar_url, stage)
      `);

      if (type === 'followers') {
        query = query.eq('following_id', userId);
      } else {
        query = query.eq('follower_id', userId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedFollowers = data?.map((follow: any) => ({
        id: follow.id,
        follower_id: follow.follower_id,
        following_id: follow.following_id,
        profiles: follow.profiles,
      })) || [];

      setFollowers(formattedFollowers);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (followId: string) => {
    if (!user) return;

    setUnfollowing(followId);
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('id', followId);

      if (error) throw error;

      setFollowers(prev => prev.filter(follow => follow.id !== followId));
      toast({
        title: "Success",
        description: type === 'following' ? "Unfollowed successfully" : "Follower removed",
      });
    } catch (error: any) {
      console.error('Error unfollowing:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to unfollow",
        variant: "destructive",
      });
    } finally {
      setUnfollowing(null);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gray-900/95 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <Users className="h-5 w-5" />
            {type === 'followers' ? 'Followers' : 'Following'}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {isOwnProfile
              ? type === 'followers'
                ? 'People following you'
                : 'People you follow'
              : type === 'followers'
              ? 'Followers'
              : 'Following'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                {type === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {followers.map((follower) => {
                const profile = follower.profiles;
                const canUnfollow = isOwnProfile && type === 'following';

                return (
                  <div
                    key={follower.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-800/50 transition-colors"
                  >
                    <Link
                      href={`/profile/${profile.id}`}
                      className="flex items-center gap-3 flex-1"
                      onClick={() => onOpenChange(false)}
                    >
                      <StorageAvatar
                        src={profile.avatar_url}
                        alt={profile.full_name}
                        fallback={getInitials(profile.full_name)}
                        className="h-10 w-10 border-2 border-amber-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-100 truncate">
                          {profile.full_name}
                        </p>
                        {profile.stage && (
                          <p className="text-sm text-gray-400 truncate">
                            {profile.stage}
                          </p>
                        )}
                      </div>
                    </Link>
                    {canUnfollow && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnfollow(follower.id)}
                        disabled={unfollowing === follower.id}
                      >
                        {unfollowing === follower.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserMinus className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
