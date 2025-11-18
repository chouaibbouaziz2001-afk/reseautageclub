"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Eye } from 'lucide-react';
import Link from 'next/link';
import { StorageAvatar } from './storage-avatar';
import { format } from 'date-fns';

interface ProfileView {
  id: string;
  viewer_id: string;
  viewed_at: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string;
    stage: string;
  };
}

interface ProfileViewersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function ProfileViewersDialog({
  open,
  onOpenChange,
  userId,
}: ProfileViewersDialogProps) {
  const [viewers, setViewers] = useState<ProfileView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadViewers();

      const viewersChannel = supabase
        .channel(`profile-viewers-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profile_views',
            filter: `viewed_profile_id=eq.${userId}`,
          },
          () => {
            loadViewers();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(viewersChannel);
      };
    }
  }, [open, userId]);

  const loadViewers = async () => {
    setLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('profile_views')
        .select(`
          id,
          viewer_id,
          viewed_at,
          profiles!profile_views_viewer_id_fkey(id, full_name, avatar_url, stage)
        `)
        .eq('viewed_profile_id', userId)
        .gte('viewed_at', thirtyDaysAgo.toISOString())
        .order('viewed_at', { ascending: false });

      if (error) throw error;

      // Remove duplicates - keep only the most recent view from each viewer
      const uniqueViewers = new Map<string, any>();
      data?.forEach((view: any) => {
        if (!uniqueViewers.has(view.viewer_id)) {
          uniqueViewers.set(view.viewer_id, view);
        }
      });

      const formattedViewers = Array.from(uniqueViewers.values()).map((view: any) => ({
        id: view.id,
        viewer_id: view.viewer_id,
        viewed_at: view.viewed_at,
        profiles: view.profiles,
      }));

      setViewers(formattedViewers);
    } catch (error) {
      console.error('Error loading profile viewers:', error);
    } finally {
      setLoading(false);
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

  const formatViewDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-gray-900/95 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-amber-400 flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Profile Viewers
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            People who viewed your profile in the last 30 days
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No profile views yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {viewers.map((viewer) => {
                const profile = viewer.profiles;
                return (
                  <div
                    key={viewer.id}
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
                    <span className="text-xs text-gray-500">
                      {formatViewDate(viewer.viewed_at)}
                    </span>
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
