"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PostCard } from '@/components/post-card';
import { StorageAvatar } from '@/components/storage-avatar';
import { Users, Eye, FileText, Briefcase, MapPin, Link as LinkIcon, Calendar, Camera, Upload, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConnectionsListDialog } from '@/components/connections-list-dialog';
import { FollowersListDialog } from '@/components/followers-list-dialog';
import { ProfileViewersDialog } from '@/components/profile-viewers-dialog';

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

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [showConnectionsDialog, setShowConnectionsDialog] = useState(false);
  const [showFollowersDialog, setShowFollowersDialog] = useState(false);
  const [showFollowingDialog, setShowFollowingDialog] = useState(false);
  const [showViewersDialog, setShowViewersDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to view your profile.",
        variant: "destructive",
      });
      setTimeout(() => router.replace('/sign-in'), 1000);
      return;
    }

    loadProfileData();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    const postsSubscription = supabase
      .channel('profile-posts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `author_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPosts((prev) => [payload.new as Post, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setPosts((prev) => prev.filter((post) => post.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            setPosts((prev) =>
              prev.map((post) => (post.id === payload.new.id ? (payload.new as Post) : post))
            );
          }
        }
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel('profile-connections')
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

    const followsChannel = supabase
      .channel('profile-follows')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
        },
        () => {
          loadStats();
        }
      )
      .subscribe();

    const profileChannel = supabase
      .channel(`own-profile-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
            setProfile(prev => prev ? { ...prev, profile_views_count: payload.new.profile_views_count } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(postsSubscription);
      supabase.removeChannel(connectionsChannel);
      supabase.removeChannel(followsChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user?.id]);

  const loadStats = async () => {
    if (!user) return;

    try {
      const [connectionsResult, followersResult, followingResult] = await Promise.all([
        supabase
          .from('connections')
          .select('*', { count: 'exact', head: true })
          .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
          .eq('status', 'accepted'),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user.id),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id),
      ]);

      setConnectionsCount(connectionsResult.count || 0);
      setFollowersCount(followersResult.count || 0);
      setFollowingCount(followingResult.count || 0);
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
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('posts')
          .select('*')
          .eq('author_id', user.id)
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

  if (!profile && loading) {
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
        <Card className="w-full max-w-md bg-gray-900/60 border-gray-800">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-300">Profile not found</p>
            <Button onClick={() => router.replace('/profile/setup')} className="mt-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">
              Complete Your Profile
            </Button>
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

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const storageRef = `user-media:${filePath}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: storageRef })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: storageRef } : null);
      await refreshUser();
      toast({
        title: "Success",
        description: "Profile photo updated successfully",
      });
      setShowPhotoDialog(false);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };


  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="text-gray-300 hover:text-amber-400 hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <Card className="mb-6 bg-gray-900/60 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="relative group">
                <StorageAvatar
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  fallback={getInitials(profile.full_name)}
                  className="h-32 w-32 border-4 border-amber-500 shadow-xl shadow-amber-500/20"
                />
                <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
                  <DialogTrigger asChild>
                    <button className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      <Camera className="h-8 w-8 text-white" />
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Update Profile Photo</DialogTitle>
                      <DialogDescription>
                        Upload a new photo for your profile
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="photo-upload">Choose Photo</Label>
                        <Input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                          }}
                          disabled={uploadingPhoto}
                          className="cursor-pointer"
                        />
                      </div>
                      {uploadingPhoto && (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-100 capitalize">{profile.full_name}</h1>
                    {profile.stage && (
                      <p className="text-gray-400 mt-1 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        {profile.stage}
                      </p>
                    )}
                    {profile.bio && (
                      <p className="text-gray-300 mt-3 max-w-2xl">{profile.bio}</p>
                    )}
                  </div>
                  <Button onClick={() => router.replace('/settings')} className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold">
                    Edit Profile
                  </Button>
                </div>

                <div className="flex flex-wrap gap-6 mt-6">
                  <button
                    onClick={() => setShowConnectionsDialog(true)}
                    className="flex items-center gap-2 hover:underline cursor-pointer transition-colors"
                  >
                    <Users className="h-5 w-5 text-amber-500" />
                    <span className="font-semibold text-gray-100">{connectionsCount}</span>
                    <span className="text-gray-400">Connections</span>
                  </button>
                  <button
                    onClick={() => setShowFollowersDialog(true)}
                    className="flex items-center gap-2 hover:underline cursor-pointer transition-colors"
                  >
                    <Users className="h-5 w-5 text-green-500" />
                    <span className="font-semibold text-gray-100">{followersCount}</span>
                    <span className="text-gray-400">Followers</span>
                  </button>
                  <button
                    onClick={() => setShowFollowingDialog(true)}
                    className="flex items-center gap-2 hover:underline cursor-pointer transition-colors"
                  >
                    <Users className="h-5 w-5 text-amber-400" />
                    <span className="font-semibold text-gray-100">{followingCount}</span>
                    <span className="text-gray-400">Following</span>
                  </button>
                  <button
                    onClick={() => setShowViewersDialog(true)}
                    className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                  >
                    <Eye className="h-5 w-5 text-amber-400" />
                    <span className="font-semibold text-gray-100">{profile.profile_views_count || 0}</span>
                    <span className="text-gray-400">Profile Views</span>
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="posts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-gray-900/60 border border-gray-800">
            <TabsTrigger value="posts">
              <FileText className="h-4 w-4 mr-2" />
              Posts ({posts.length})
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {posts.length > 0 ? (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={{
                    id: post.id,
                    authorId: user!.id,
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
              <Card className="bg-gray-900/60 border-gray-800">
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No posts yet</p>
                  <Button onClick={() => router.replace('/feed')} className="mt-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">
                    Create Your First Post
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="about">
            <Card className="bg-gray-900/60 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-100 mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-500" />
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
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Bio</h3>
                      <p className="text-gray-300">{profile.bio}</p>
                    </div>
                  </>
                )}

                {profile.skills && profile.skills.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.skills.map((skill, index) => (
                          <Badge key={index} className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {profile.interests && profile.interests.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Interests</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.interests.map((interest, index) => (
                          <Badge key={index} className="bg-gray-800 text-gray-300 border-gray-700">
                            {interest}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {profile.looking_for && profile.looking_for.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-semibold text-gray-100 mb-3">Looking For</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.looking_for.map((item, index) => (
                          <Badge key={index} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900">
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

          <TabsContent value="connections">
            <Card className="bg-gray-900/60 border-gray-800">
              <CardHeader>
                <CardTitle className="text-gray-100">Connections & Network</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border border-gray-800 bg-gray-800/50 rounded-lg text-center">
                    <Users className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-100">{connectionsCount}</p>
                    <p className="text-sm text-gray-400">Connections</p>
                  </div>
                  <div className="p-4 border border-gray-800 bg-gray-800/50 rounded-lg text-center">
                    <Users className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-100">{followersCount}</p>
                    <p className="text-sm text-gray-400">Followers</p>
                  </div>
                  <div className="p-4 border border-gray-800 bg-gray-800/50 rounded-lg text-center">
                    <Users className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-100">{followingCount}</p>
                    <p className="text-sm text-gray-400">Following</p>
                  </div>
                </div>
                <div className="mt-6 text-center text-gray-400">
                  <p>Visit the Network page to manage your connections</p>
                  <Button onClick={() => router.replace('/network')} className="mt-4 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">
                    View Network
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConnectionsListDialog
        open={showConnectionsDialog}
        onOpenChange={setShowConnectionsDialog}
        userId={user!.id}
        isOwnProfile={true}
      />

      <FollowersListDialog
        open={showFollowersDialog}
        onOpenChange={setShowFollowersDialog}
        userId={user!.id}
        type="followers"
        isOwnProfile={true}
      />

      <FollowersListDialog
        open={showFollowingDialog}
        onOpenChange={setShowFollowingDialog}
        userId={user!.id}
        type="following"
        isOwnProfile={true}
      />

      <ProfileViewersDialog
        open={showViewersDialog}
        onOpenChange={setShowViewersDialog}
        userId={user!.id}
      />
    </div>
  );
}
