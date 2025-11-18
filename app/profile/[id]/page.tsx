"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PostCard } from '@/components/post-card';
import { ConnectionsListDialog } from '@/components/connections-list-dialog';
import { FollowersListDialog } from '@/components/followers-list-dialog';
import { StorageAvatar } from '@/components/storage-avatar';
import { Users, Eye, FileText, Briefcase, Calendar, UserPlus, UserCheck, MessageSquare, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { notificationHelpers } from '@/lib/notifications';
import { useDatabase } from '@/lib/db-context';
import { sanitizeUuid } from '@/lib/sanitize';

interface Profile {
  id: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  stage: string;
  looking_for: string[];
  skills: string[];
  interests: string[];
  profile_views_count: number;
  phone_number: string;
  email: string;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  likes_count: number;
  comments_count: number;
  share_count: number;
  shared_post_id: string | null;
  shared_post?: {
    id: string;
    author_id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    author?: {
      full_name: string;
      avatar_url: string | null;
    };
  };
}

export default function UserProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const { profile: currentUserProfile } = useDatabase();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();

  // Validate UUID
  const profileId = sanitizeUuid(params.id as string);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [commonConnections, setCommonConnections] = useState(0);
  const [commonFollowers, setCommonFollowers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);

  const isOwnProfile = user?.id === profileId;

  useEffect(() => {
    if (authLoading) return;

    // Check if profileId is valid
    if (!profileId) {
      toast({
        title: "Invalid Profile",
        description: "The profile ID is invalid.",
        variant: "destructive",
      });
      setTimeout(() => router.replace('/feed'), 1000);
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to view profiles.",
        variant: "destructive",
      });
      setTimeout(() => router.replace('/sign-in'), 1000);
      return;
    }

    if (isOwnProfile) {
      toast({
        title: "Redirecting",
        description: "Taking you to your profile page...",
      });
      setTimeout(() => router.replace('/profile'), 1000);
      return;
    }

    loadProfileData();
    trackProfileView();
  }, [user?.id, profileId, authLoading]);

  useEffect(() => {
    if (!user || !profileId || isOwnProfile) return;

    const followsChannel = supabase
      .channel(`profile-follows-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${profileId}`,
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel(`profile-connections-${profileId}`)
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
      .channel(`profile-updates-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profileId}`,
        },
        (payload) => {
          if (payload.new) {
            setProfile(prev => prev ? { ...prev, profile_views_count: payload.new.profile_views_count } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(followsChannel);
      supabase.removeChannel(connectionsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id, profileId]);

  const trackProfileView = async () => {
    if (!user || !profileId || isOwnProfile || !currentUserProfile) return;

    try {
      await supabase.from('profile_views').insert({
        viewer_id: user.id,
        viewed_profile_id: profileId,
      });

      await notificationHelpers.profileView(
        user.id,
        profileId,
        currentUserProfile.fullName
      );
    } catch (error) {
      console.error('Error tracking profile view:', error);
    }
  };

  const loadStats = async () => {
    if (!user) return;

    try {
      const [
        connectionsResult,
        followersResult,
        followingResult,
        followingDataResult,
        connectionDataResult,
        commonConnectionsResult,
        commonFollowersResult,
      ] = await Promise.all([
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .or(`requester_id.eq.${profileId},recipient_id.eq.${profileId}`)
          .eq('status', 'accepted'),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', profileId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', profileId),
        supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', profileId)
          .maybeSingle(),
        supabase
          .from('connections')
          .select('*')
          .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .or(`requester_id.eq.${profileId},recipient_id.eq.${profileId}`)
          .maybeSingle(),
        supabase.rpc('get_common_connections', {
          user1_id: user.id,
          user2_id: profileId,
        }),
        supabase.rpc('get_common_followers', {
          user1_id: user.id,
          user2_id: profileId,
        }),
      ]);

      setConnectionsCount(connectionsResult.count || 0);
      setFollowersCount(followersResult.count || 0);
      setFollowingCount(followingResult.count || 0);
      setIsFollowing(!!followingDataResult.data);

      if (connectionDataResult.data) {
        setConnectionStatus(connectionDataResult.data.status);
        setIsConnected(connectionDataResult.data.status === 'accepted');
      } else {
        setConnectionStatus(null);
        setIsConnected(false);
      }

      setCommonConnections(commonConnectionsResult.count || 0);
      setCommonFollowers(commonFollowersResult.count || 0);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const [profileResult, postsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .maybeSingle(),
        supabase
          .from('posts')
          .select('*')
          .eq('author_id', profileId)
          .order('created_at', { ascending: false }),
      ]);

      if (profileResult.data) {
        setProfile(profileResult.data);
        setLoading(false);
      }

      if (postsResult.data) {
        const postsWithShared = await Promise.all(
          postsResult.data.map(async (post) => {
            if (post.shared_post_id) {
              const { data: sharedPost } = await supabase
                .from('posts')
                .select(`
                  *,
                  author:profiles!posts_author_id_fkey(full_name, avatar_url)
                `)
                .eq('id', post.shared_post_id)
                .maybeSingle();

              return { ...post, shared_post: sharedPost };
            }
            return post;
          })
        );
        setPosts(postsWithShared);
      }

      loadStats();
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user || !profileId || !currentUserProfile) return;

    try {
      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', profileId);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast({
          title: "Success",
          description: "Unfollowed successfully",
        });
      } else {
        await supabase.from('follows').insert({
          follower_id: user.id,
          following_id: profileId,
        });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);

        await notificationHelpers.follow(
          user.id,
          profileId,
          currentUserProfile.fullName
        );

        toast({
          title: "Success",
          description: "Followed successfully",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update follow status",
        variant: "destructive",
      });
    }
  };

  const handleCopyLink = async () => {
    if (!profileId) return;

    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'profile',
      id: profileId,
    });

    if (success) {
      toast({
        title: 'Link copied!',
        description: getCopySuccessMessage('profile'),
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  const handleConnect = async () => {
    if (!user || !profileId || !currentUserProfile) return;

    try {
      await supabase.from('connections').insert({
        requester_id: user.id,
        recipient_id: profileId,
        status: 'pending',
      });
      setConnectionStatus('pending');

      await notificationHelpers.connectionRequest(
        user.id,
        profileId,
        currentUserProfile.fullName
      );

      toast({
        title: "Success",
        description: "Connection request sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send connection request",
        variant: "destructive",
      });
    }
  };

  if (authLoading || (!profile && loading)) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile && !loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-gray-900/90 border-gray-700">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-300">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-gray-800 text-gray-300 hover:text-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <Card className="mb-6 bg-gradient-to-r from-gray-900 to-stone-900 border-2 border-amber-500/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <StorageAvatar
                src={profile.avatar_url}
                alt={profile.full_name}
                fallback={getInitials(profile.full_name)}
                className="h-32 w-32 border-4 border-amber-500/30 shadow-2xl shadow-amber-500/20 text-3xl"
              />

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent capitalize">{profile.full_name}</h1>
                    {profile.stage && (
                      <p className="text-gray-300 mt-2 flex items-center gap-2 text-base">
                        <Briefcase className="h-4 w-4 text-amber-400" />
                        {profile.stage}
                      </p>
                    )}
                    {profile.bio && (
                      <p className="text-gray-200 mt-3 max-w-2xl leading-relaxed">{profile.bio}</p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      onClick={handleFollow}
                      variant={isFollowing ? "outline" : "default"}
                      className={isFollowing ? "border-amber-500 text-amber-400 hover:bg-amber-500/10" : "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold"}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="h-4 w-4 mr-2" />
                          Following
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Follow
                        </>
                      )}
                    </Button>
                    {!isConnected && !connectionStatus && (
                      <Button onClick={handleConnect} variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                        Connect
                      </Button>
                    )}
                    {connectionStatus === 'pending' && (
                      <Button variant="outline" disabled className="border-gray-600 text-gray-400">
                        Pending
                      </Button>
                    )}
                    <Button variant="outline" asChild className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                      <Link href={`/messages?user=${profileId}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button onClick={handleCopyLink} variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-6 mt-6">
                  <button
                    onClick={() => setShowConnectionsDialog(true)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Users className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold text-gray-100">{connectionsCount}</span>
                    <span className="text-gray-400">Connections</span>
                  </button>
                  <button
                    onClick={() => setShowFollowersDialog(true)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Users className="h-5 w-5 text-green-400" />
                    <span className="font-semibold text-gray-100">{followersCount}</span>
                    <span className="text-gray-400">Followers</span>
                  </button>
                  <button
                    onClick={() => setShowFollowingDialog(true)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                  >
                    <Users className="h-5 w-5 text-purple-400" />
                    <span className="font-semibold text-gray-100">{followingCount}</span>
                    <span className="text-gray-400">Following</span>
                  </button>
                </div>

                {(commonConnections > 0 || commonFollowers > 0) && (
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    {commonConnections > 0 && (
                      <span className="text-amber-400">{commonConnections} mutual connection{commonConnections !== 1 ? 's' : ''}</span>
                    )}
                    {commonFollowers > 0 && (
                      <span className="text-amber-400">{commonFollowers} mutual follower{commonFollowers !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 bg-gray-900 border border-amber-500/30">
            <TabsTrigger value="posts" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-gray-900 text-gray-400">
              <FileText className="h-4 w-4 mr-2" />
              Posts ({posts.length})
            </TabsTrigger>
            <TabsTrigger value="about" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-gray-900 text-gray-400">About</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {posts.length > 0 ? (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    authorId: profileId || '',
                    authorName: profile.full_name,
                    authorPhoto: profile.avatar_url,
                    content: post.content,
                    images: post.image_url ? [post.image_url] : [],
                    likes: [],
                    comments: [],
                    createdAt: post.created_at,
                    shareCount: post.share_count || 0,
                    sharedPostId: post.shared_post_id || undefined,
                    sharedPost: post.shared_post ? {
                      id: post.shared_post.id,
                      authorId: post.shared_post.author_id,
                      authorName: post.shared_post.author?.full_name || 'Unknown',
                      authorPhoto: post.shared_post.author?.avatar_url || undefined,
                      content: post.shared_post.content,
                      images: post.shared_post.image_url ? [post.shared_post.image_url] : [],
                      likes: [],
                      comments: [],
                      createdAt: post.shared_post.created_at,
                      shareCount: 0,
                    } : undefined,
                  }}
                  onUpdate={loadProfileData}
                />
              ))
            ) : (
              <Card className="bg-gray-900/50 border-gray-700">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No posts yet</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="about">
            <Card className="bg-gray-900/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-amber-400">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-400" />
                    Member Since
                  </h3>
                  <p className="text-gray-300">
                    {new Date(profile.created_at).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                {profile.bio && (
                  <>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Bio</h3>
                      <p className="text-gray-300 leading-relaxed">{profile.bio}</p>
                    </div>
                  </>
                )}

                {profile.skills && profile.skills.length > 0 && (
                  <>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill, index) => (
                          <Badge key={index} variant="secondary" className="bg-gray-800 text-gray-200 border-gray-700">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest, index) => (
                          <Badge key={index} variant="outline" className="border-amber-500/50 text-amber-400">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {profile.looking_for && profile.looking_for.length > 0 && (
                  <>
                    <Separator className="bg-gray-700" />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Looking For</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.looking_for.map((item, index) => (
                          <Badge key={index} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 border-0">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConnectionsListDialog
        open={showConnectionsDialog}
        onOpenChange={setShowConnectionsDialog}
        userId={profileId || ''}
        isOwnProfile={false}
      />

      <FollowersListDialog
        open={showFollowersDialog}
        onOpenChange={setShowFollowersDialog}
        userId={profileId || ''}
        type="followers"
        isOwnProfile={false}
      />

      <FollowersListDialog
        open={showFollowingDialog}
        onOpenChange={setShowFollowingDialog}
        userId={profileId || ''}
        type="following"
        isOwnProfile={false}
      />

    </div>
  );
}
