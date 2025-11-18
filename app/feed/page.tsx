"use client";

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { PostComposer } from '@/components/post-composer';
import { PostCard } from '@/components/post-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Lightbulb, TrendingUp, FileText, Home, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { FeedSkeleton } from '@/components/skeleton-loaders';
import LazyLoadList from '@/components/lazy-load-list';
import { fetchPosts } from '@/lib/database-queries';
import { ConnectionTest } from '@/components/connection-test';
import { toast } from 'sonner';

interface PostAuthor {
  full_name: string;
  avatar_url: string | null;
}

interface SharedPost {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  author?: PostAuthor;
  taggedUsers?: string[];
}

interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  media_type: string | null;
  created_at: string;
  likes_count: number;
  comments_count: number;
  share_count: number;
  shared_post_id: string | null;
  author?: PostAuthor;
  shared_post?: SharedPost | null;
  taggedUsers?: string[];
}

export default function Feed() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const loadPosts = async (pageNum: number = 0, append: boolean = false) => {
    try {
      console.log('[Feed] Loading posts, page:', pageNum);
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const data = await fetchPosts(PAGE_SIZE, pageNum * PAGE_SIZE);
      console.log('[Feed] Posts loaded:', data?.length || 0);

      if (!data || data.length === 0) {
        console.log('[Feed] No posts returned from database');
        setPosts([]);
        setLoading(false);
        return;
      }

      const postIds = data.map(p => p.id);
      const sharedPostIds = data.map(p => p.shared_post_id).filter(Boolean);

      const { data: allMentions } = await supabase
        .from('post_mentions')
        .select('post_id, mentioned_user_id')
        .in('post_id', [...postIds, ...sharedPostIds]);

      const mentionsMap = (allMentions || []).reduce((acc, m) => {
        if (!acc[m.post_id]) acc[m.post_id] = [];
        acc[m.post_id].push(m.mentioned_user_id);
        return acc;
      }, {} as Record<string, string[]>);

      const { data: sharedPosts } = sharedPostIds.length > 0 ? await supabase
        .from('posts')
        .select(`
          id,
          author_id,
          content,
          image_url,
          video_url,
          media_type,
          created_at,
          author:profiles!posts_author_id_fkey(full_name, avatar_url)
        `)
        .in('id', sharedPostIds) : { data: [] };

      const sharedPostsMap = (sharedPosts || []).reduce((acc, sp: any) => {
        // Handle case where author might be an array from Supabase join
        const author = Array.isArray(sp.author) ? sp.author[0] : sp.author;
        acc[sp.id] = { 
          ...sp, 
          author: author ? {
            full_name: author.full_name || '',
            avatar_url: author.avatar_url || null
          } : undefined,
          taggedUsers: mentionsMap[sp.id] || [] 
        };
        return acc;
      }, {} as Record<string, SharedPost>);

      const postsWithShared = data.map(post => ({
        ...post,
        taggedUsers: mentionsMap[post.id] || [],
        shared_post: post.shared_post_id ? sharedPostsMap[post.shared_post_id] : null
      }));

      console.log('[Feed] Posts with shared data:', postsWithShared.length);

      if (append) {
        setPosts((prev) => [...prev, ...postsWithShared]);
      } else {
        setPosts(postsWithShared);
      }

      setHasMore(postsWithShared.length === PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
    } catch (error) {
      console.error('[Feed] Error loading posts:', error);
      setError(error instanceof Error ? error.message : 'Failed to load posts');
      if (!append) {
        setPosts([]);
      }
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMorePosts = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadPosts(nextPage, true);
    }
  }, [loadingMore, hasMore, page]);

  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMorePosts,
    hasMore,
    isLoading: loadingMore,
  });

  useEffect(() => {
    console.log('[Feed] User status:', { hasUser: !!user, hasProfile: !!profile, profileCompleted: profile?.profileCompleted });

    if (!user) {
      console.log('[Feed] No user, redirecting to sign-in');
      toast.error('Please sign in to access the feed.');
      setTimeout(() => router.replace('/sign-in'), 1000);
      return;
    }

    if (profile && !profile.profileCompleted) {
      console.log('[Feed] Profile incomplete, redirecting to setup');
      toast.info('Please complete your profile to continue.');
      setTimeout(() => router.replace('/profile/setup'), 1000);
      return;
    }

    if (user && profile && profile.profileCompleted) {
      console.log('[Feed] Loading feed data...');
      loadPosts();
      loadStats();
    }
  }, [user?.id, profile?.profileCompleted]);

  useEffect(() => {
    if (!user || !profile) return;

    console.log('[Feed] Setting up realtime subscription');

    const postsSubscription = supabase
      .channel('feed-posts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
        },
        async (payload) => {
          console.log('[Feed] New post detected:', payload.new);

          // Fetch the complete post data with author info
          const { data: newPost } = await supabase
            .from('posts')
            .select(`
              *,
              author:profiles!posts_author_id_fkey(full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newPost) {
            // Fetch mentions
            const { data: mentionData } = await supabase
              .from('post_mentions')
              .select('mentioned_user_id')
              .eq('post_id', newPost.id);

            const taggedUsers = mentionData?.map(m => m.mentioned_user_id) || [];

            // Add to top of feed with animation class (avoid duplicates)
            setPosts((prevPosts) => {
              // Check if post already exists
              if (prevPosts.some(p => p.id === newPost.id)) {
                return prevPosts;
              }
              return [{
                ...newPost,
                taggedUsers,
                isNew: true
              } as any, ...prevPosts];
            });

            // Remove animation flag after delay
            setTimeout(() => {
              setPosts((prevPosts) =>
                prevPosts.map(p => p.id === newPost.id ? { ...p, isNew: false } : p)
              );
            }, 2000);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('[Feed] Post updated:', payload.new);

          // Update the post in the list
          setPosts((prevPosts) =>
            prevPosts.map((post) =>
              post.id === payload.new.id
                ? { ...post, ...payload.new }
                : post
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'posts',
        },
        (payload) => {
          console.log('[Feed] Post deleted:', payload.old);

          // Remove the post from the list
          setPosts((prevPosts) =>
            prevPosts.filter((post) => post.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      console.log('[Feed] Cleaning up realtime subscription');
      supabase.removeChannel(postsSubscription);
    };
  }, [user?.id]);

  const loadStats = async () => {
    if (!user) return;

    try {
      console.log('[Feed] Loading stats...');
      // Load connections count
      const { count: connectionsCountData } = await supabase
        .from('connections')
        .select('*', { count: 'exact', head: true })
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .eq('status', 'accepted');

      setConnectionsCount(connectionsCountData || 0);

      // Load profile views count
      const { data: profileData } = await supabase
        .from('profiles')
        .select('profile_views_count')
        .eq('id', user.id)
        .maybeSingle();

      setProfileViewsCount(profileData?.profile_views_count || 0);
      console.log('[Feed] Stats loaded:', { connections: connectionsCountData || 0, views: profileData?.profile_views_count || 0 });
    } catch (error) {
      console.error('[Feed] Error loading stats:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    const connectionsChannel = supabase
      .channel('home-connections')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'connections',
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel('home-profile')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(connectionsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user]);

  if (!user || !profile) return null;

  if (loading) {
    return <FeedSkeleton />;
  }

  const userPosts = posts.filter(p => p.author_id === user.id);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 no-h-scroll">

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="grid lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          <div className="lg:col-span-2 space-y-3 sm:space-y-4 md:space-y-6">
            <Card className="bg-gradient-to-r from-gray-900 to-stone-900 text-white border-2 border-amber-500">
              <CardContent className="p-4 sm:p-6">
                <h2 className="text-xl sm:text-2xl font-bold mb-2 bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">Welcome back, {user.fullName}!</h2>
                <p className="text-gray-300">Here's what's happening in your network</p>
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-3 gap-4">
              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-100">{connectionsCount}</p>
                  <p className="text-sm text-gray-400">Connections</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-100">{userPosts.length}</p>
                  <p className="text-sm text-gray-400">Posts</p>
                </CardContent>
              </Card>

              <Card className="bg-gray-900/50 border-gray-800">
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-amber-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-100">{profileViewsCount}</p>
                  <p className="text-sm text-gray-400">Profile Views</p>
                </CardContent>
              </Card>
            </div>

            <PostComposer onPostCreated={loadPosts} />

            {error && (
              <Card className="bg-red-900/20 border-red-500">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <p className="font-semibold">Error loading feed:</p>
                    <p>{error}</p>
                  </div>
                  <Button
                    onClick={() => loadPosts(0, false)}
                    variant="outline"
                    className="mt-4 border-red-500 text-red-400 hover:bg-red-500/10"
                  >
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            )}

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-4">
                      <div className="flex gap-3 mb-3">
                        <div className="h-12 w-12 bg-gray-200 rounded-full" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-1/4" />
                          <div className="h-3 bg-gray-200 rounded w-1/6" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-full" />
                        <div className="h-4 bg-gray-200 rounded w-5/6" />
                        <div className="h-4 bg-gray-200 rounded w-4/6" />
                      </div>
                      <div className="mt-3 h-48 bg-gray-200 rounded-lg" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-4">
                    <div className="text-6xl">📢</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-2">No posts yet</h3>
                      <p className="text-gray-400">
                        Be the first to share!
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => {
                  const author = Array.isArray(post.author) ? post.author[0] : post.author;
                  const adaptedPost = {
                    id: post.id,
                    authorId: post.author_id,
                    authorName: author?.full_name || 'Unknown',
                    authorPhoto: author?.avatar_url || undefined,
                    content: post.content,
                    images: post.image_url ? [post.image_url] : [],
                    videoUrl: post.video_url || undefined,
                    mediaType: post.media_type as 'image' | 'video' | null | undefined,
                    likes: [],
                    comments: [],
                    createdAt: post.created_at,
                    shareCount: post.share_count || 0,
                    sharedPostId: post.shared_post_id || undefined,
                    taggedUsers: post.taggedUsers || [],
                    sharedPost: post.shared_post ? {
                      id: post.shared_post.id,
                      authorId: post.shared_post.author_id,
                      authorName: (Array.isArray(post.shared_post.author) ? post.shared_post.author[0] : post.shared_post.author)?.full_name || 'Unknown',
                      authorPhoto: (Array.isArray(post.shared_post.author) ? post.shared_post.author[0] : post.shared_post.author)?.avatar_url || undefined,
                      content: post.shared_post.content,
                      images: post.shared_post.image_url ? [post.shared_post.image_url] : [],
                      videoUrl: post.shared_post.video_url || undefined,
                      mediaType: post.shared_post.media_type as 'image' | 'video' | null | undefined,
                      likes: [],
                      comments: [],
                      createdAt: post.shared_post.created_at,
                      shareCount: 0,
                      taggedUsers: post.shared_post.taggedUsers || [],
                    } : undefined,
                  };
                  return <PostCard key={post.id} post={adaptedPost} onUpdate={() => loadPosts(0, false)} />;
                })}

                <div ref={observerTarget} className="py-4">
                  {loadingMore && (
                    <div className="text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-500 mx-auto" />
                      <p className="text-sm text-gray-400 mt-2">Loading more posts...</p>
                    </div>
                  )}
                  {!hasMore && posts.length > 0 && (
                    <div className="text-center text-gray-400 text-sm">
                      You've reached the end of the feed
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Suggested Connections</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Trending Topics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Coming soon...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
