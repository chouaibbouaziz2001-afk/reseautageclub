"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserCheck, UserMinus, X, Check, MessageCircle, Home } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { notificationHelpers } from '@/lib/notifications';
import { StorageAvatar } from '@/components/storage-avatar';
import { NetworkSkeleton } from '@/components/skeleton-loaders';
import LazyLoadList from '@/components/lazy-load-list';
import { toast } from 'sonner';

interface Profile {
  id: string;
  full_name: string;
  bio: string | null;
  avatar_url: string | null;
  stage: string | null;
  skills: string[];
  looking_for: string[];
  interests: string[];
}

interface Connection {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: string;
  created_at: string;
  requester?: Profile;
  recipient?: Profile;
}

interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  following?: Profile;
}

export default function Network() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [follows, setFollows] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      toast.error('Please sign in to view your network.');
      setTimeout(() => router.replace('/sign-in'), 1000);
      return;
    }

    if (profile && !profile.profileCompleted) {
      toast.info('Please complete your profile to continue.');
      setTimeout(() => router.replace('/profile/setup'), 1000);
      return;
    }

    if (user && profile) {
      loadNetworkData();
    }
  }, [user?.id, profile?.profileCompleted]);

  useEffect(() => {
    if (!user || !profile) return;

    console.log('[Network] Setting up realtime subscriptions');

    const connectionsChannel = supabase
      .channel('network-connections')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'connections',
        },
        async (payload) => {
          console.log('[Network] New connection:', payload.new);

          // Fetch complete connection with profile data
          const { data: newConnection } = await supabase
            .from('connections')
            .select(`
              *,
              requester:requester_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests),
              recipient:recipient_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newConnection) {
            setConnections((prev) => [...prev, newConnection]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          console.log('[Network] Connection updated:', payload.new);

          // Update connection in list
          setConnections((prev) =>
            prev.map((conn) =>
              conn.id === payload.new.id ? { ...conn, ...payload.new } : conn
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'connections',
        },
        (payload) => {
          console.log('[Network] Connection deleted:', payload.old);

          // Remove connection from list
          setConnections((prev) => prev.filter((conn) => conn.id !== payload.old.id));
        }
      )
      .subscribe();

    const followsChannel = supabase
      .channel('network-follows')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'follows',
        },
        async (payload) => {
          console.log('[Network] New follow:', payload.new);

          // Fetch complete follow with profile data
          const { data: newFollow } = await supabase
            .from('follows')
            .select(`
              *,
              following:following_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newFollow) {
            setFollows((prev) => [...prev, newFollow]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
        },
        (payload) => {
          console.log('[Network] Follow deleted:', payload.old);

          // Remove follow from list
          setFollows((prev) => prev.filter((follow) => follow.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(connectionsChannel);
      supabase.removeChannel(followsChannel);
    };
  }, [user?.id]);

  const loadNetworkData = async () => {
    setLoading(true);

    const [profilesRes, connectionsRes, followsRes] = await Promise.all([
      supabase.from('profiles').select('*').neq('id', user!.id),
      supabase
        .from('connections')
        .select(`
          *,
          requester:requester_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests),
          recipient:recipient_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests)
        `)
        .or(`requester_id.eq.${user!.id},recipient_id.eq.${user!.id}`),
      supabase
        .from('follows')
        .select(`
          *,
          following:following_id(id, full_name, bio, avatar_url, stage, skills, looking_for, interests)
        `)
        .eq('follower_id', user!.id)
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data);
    if (connectionsRes.data) setConnections(connectionsRes.data);
    if (followsRes.data) setFollows(followsRes.data);

    setLoading(false);
  };

  const sendConnectionRequest = async (recipientId: string) => {
    await supabase.from('connections').insert({
      requester_id: user!.id,
      recipient_id: recipientId,
      status: 'pending'
    });

    await notificationHelpers.connectionRequest(
      user!.id,
      recipientId,
      profile?.fullName || 'Someone'
    );

    // Realtime will handle updating the UI
  };

  const cancelConnectionRequest = async (connectionId: string) => {
    await supabase.from('connections').delete().eq('id', connectionId);
    // Realtime will handle updating the UI
  };

  const acceptConnection = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);

    await supabase
      .from('connections')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', connectionId);

    if (connection) {
      await notificationHelpers.connectionAccepted(
        user!.id,
        connection.requester_id,
        profile?.fullName || 'Someone'
      );
    }

    // Realtime will handle updating the UI
  };

  const rejectConnection = async (connectionId: string) => {
    await supabase
      .from('connections')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', connectionId);
    // Realtime will handle updating the UI
  };

  const followUser = async (followingId: string) => {
    await supabase.from('follows').insert({
      follower_id: user!.id,
      following_id: followingId
    });

    await notificationHelpers.follow(
      user!.id,
      followingId,
      profile?.fullName || 'Someone'
    );

    // Realtime will handle updating the UI
  };

  const unfollowUser = async (followingId: string) => {
    await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user!.id)
      .eq('following_id', followingId);
    // Realtime will handle updating the UI
  };

  const getConnectionStatus = (profileId: string) => {
    return connections.find(
      c =>
        (c.requester_id === user!.id && c.recipient_id === profileId) ||
        (c.recipient_id === user!.id && c.requester_id === profileId)
    );
  };

  const isFollowing = (profileId: string) => {
    return follows.some(f => f.following_id === profileId);
  };

  const startConversation = async (otherUserId: string) => {
    const participant1 = user!.id < otherUserId ? user!.id : otherUserId;
    const participant2 = user!.id < otherUserId ? otherUserId : user!.id;

    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('participant_1_id', participant1)
      .eq('participant_2_id', participant2)
      .maybeSingle();

    if (existingConv) {
      toast.success('Opening conversation...');
      setTimeout(() => router.replace('/messages'), 1000);
    } else {
      const { error } = await supabase.from('conversations').insert({
        participant_1_id: participant1,
        participant_2_id: participant2
      });

      if (!error) {
        toast.success('Conversation started! Redirecting...');
        setTimeout(() => router.replace('/messages'), 1000);
      } else {
        toast.error('Failed to start conversation. Please try again.');
      }
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.bio?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.skills?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.interests?.some(i => i.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pendingRequests = connections.filter(
    c => c.recipient_id === user!.id && c.status === 'pending'
  );

  const sentRequests = connections.filter(
    c => c.requester_id === user!.id && c.status === 'pending'
  );

  const myConnections = connections.filter(c => c.status === 'accepted');

  if (!user || !profile) return null;

  if (loading) {
    return <NetworkSkeleton />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-6 md:py-8">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100 mb-1 sm:mb-2">Network</h1>
          <p className="text-sm sm:text-base text-gray-400 truncate">Connect with fellow entrepreneurs and grow your network</p>
        </div>

        <Tabs defaultValue="discover" className="space-y-3 sm:space-y-4 md:space-y-6">
          <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="discover" className="text-xs sm:text-sm px-2 py-2">Discover</TabsTrigger>
            <TabsTrigger value="connections" className="text-xs sm:text-sm px-2 py-2">
              <span className="truncate">Connections {myConnections.length > 0 && `(${myConnections.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs sm:text-sm px-2 py-2">
              <span className="truncate">Requests {pendingRequests.length > 0 && `(${pendingRequests.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="following" className="text-xs sm:text-sm px-2 py-2">
              <span className="truncate">Following {follows.length > 0 && `(${follows.length})`}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-3 sm:space-y-4 md:space-y-6">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 bg-gray-200 rounded-full" />
                        <div className="flex-1 space-y-3">
                          <div className="h-4 bg-gray-200 rounded w-1/2" />
                          <div className="h-3 bg-gray-200 rounded w-full" />
                          <div className="h-3 bg-gray-200 rounded w-3/4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <LazyLoadList
                items={filteredProfiles}
                itemsPerPage={10}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 md:gap-6"
                renderItem={(profile: Profile) => {
                  const connectionStatus = getConnectionStatus(profile.id);
                  const following = isFollowing(profile.id);

                  return (
                    <Card key={profile.id} className="active:shadow-md sm:hover:shadow-md transition-shadow">
                      <CardContent className="p-4 sm:p-5 md:p-6">
                        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
                          <Link href={`/profile/${profile.id}`} className="flex-shrink-0">
                            <StorageAvatar
                              src={profile.avatar_url}
                              fallback={profile.full_name.split(' ').map((n: string) => n[0]).join('')}
                              className="h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                            />
                          </Link>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <Link href={`/profile/${profile.id}`} className="hover:underline">
                              <h3 className="font-semibold text-base sm:text-lg text-gray-100 truncate">
                                {profile.full_name}
                              </h3>
                            </Link>
                            {profile.stage && (
                              <Badge variant="secondary" className="mt-1 text-xs truncate max-w-[120px]">
                                {profile.stage}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {profile.bio && (
                          <p className="text-gray-400 text-xs sm:text-sm mb-3 sm:mb-4 line-clamp-2">{profile.bio}</p>
                        )}

                        {profile.skills && profile.skills.length > 0 && (
                          <div className="mb-3 sm:mb-4">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">Skills</p>
                            <div className="flex flex-wrap gap-1 overflow-hidden">
                              {profile.skills.slice(0, 2).map((skill: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs truncate max-w-[100px]">
                                  {skill}
                                </Badge>
                              ))}
                              {profile.skills.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{profile.skills.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1.5 sm:gap-2">
                          <div className="flex gap-1.5 sm:gap-2">
                            {!connectionStatus && (
                              <Button
                                onClick={() => sendConnectionRequest(profile.id)}
                                className="flex-1 text-xs sm:text-sm px-2"
                                size="sm"
                              >
                                <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="truncate">Connect</span>
                              </Button>
                            )}

                            {connectionStatus?.status === 'pending' && connectionStatus.requester_id === user.id && (
                              <Button
                                onClick={() => cancelConnectionRequest(connectionStatus.id)}
                                variant="outline"
                                className="flex-1 text-xs sm:text-sm px-2"
                                size="sm"
                              >
                                <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="truncate">Cancel</span>
                              </Button>
                            )}

                            {connectionStatus?.status === 'accepted' && (
                              <Button variant="outline" className="flex-1 text-xs sm:text-sm px-2" size="sm" disabled>
                                <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="truncate">Connected</span>
                              </Button>
                            )}

                            {!following ? (
                              <Button
                                onClick={() => followUser(profile.id)}
                                variant="secondary"
                                size="sm"
                                className="text-xs sm:text-sm px-2 flex-shrink-0"
                              >
                                <span className="truncate">Follow</span>
                              </Button>
                            ) : (
                              <Button
                                onClick={() => unfollowUser(profile.id)}
                                variant="outline"
                                size="sm"
                                className="text-xs sm:text-sm px-2 flex-shrink-0"
                              >
                                <UserMinus className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                <span className="truncate">Unfollow</span>
                              </Button>
                            )}
                          </div>
                          <Button
                            onClick={() => startConversation(profile.id)}
                            variant="outline"
                            size="sm"
                            className="w-full text-xs sm:text-sm"
                          >
                            <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            <span className="truncate">Message</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                }}
                emptyComponent={
                  <Card className="md:col-span-2">
                    <CardContent className="py-12">
                      <div className="text-center space-y-3">
                        <div className="text-5xl">🔍</div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-100 mb-1">No profiles found</h3>
                          <p className="text-gray-400 text-sm">Try adjusting your search</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="connections" className="space-y-4">
            {myConnections.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">🤝</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">No connections yet</h3>
                      <p className="text-gray-400 text-sm">Start connecting with entrepreneurs in the Discover tab</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {myConnections.map((connection) => {
                  const otherUser = connection.requester_id === user.id
                    ? connection.recipient
                    : connection.requester;

                  if (!otherUser) return null;

                  return (
                    <Card key={connection.id}>
                      <CardContent className="p-4 sm:p-5 md:p-6">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <Link href={`/profile/${otherUser.id}`} className="flex-shrink-0">
                            <StorageAvatar
                              src={otherUser.avatar_url}
                              fallback={otherUser.full_name.split(' ').map(n => n[0]).join('')}
                              className="h-10 w-10 sm:h-12 sm:w-12 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                            />
                          </Link>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                              <Link href={`/profile/${otherUser.id}`} className="hover:underline flex-1 min-w-0">
                                <h3 className="font-semibold text-sm sm:text-base text-gray-100 truncate">
                                  {otherUser.full_name}
                                </h3>
                              </Link>
                              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                            </div>
                            {otherUser.stage && (
                              <Badge variant="secondary" className="mt-1 text-xs truncate max-w-[100px]">
                                {otherUser.stage}
                              </Badge>
                            )}
                            <Button
                              onClick={() => startConversation(otherUser.id)}
                              variant="outline"
                              size="sm"
                              className="mt-2 sm:mt-3 w-full text-xs sm:text-sm"
                            >
                              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                              <span className="truncate">Message</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {pendingRequests.length === 0 && sentRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">📬</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">No pending requests</h3>
                      <p className="text-gray-400 text-sm">Connection requests will appear here</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {pendingRequests.length > 0 && (
                  <div className="space-y-3 sm:space-y-4">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-100">Received Requests</h2>
                    {pendingRequests.map((connection) => {
                      const requester = connection.requester;
                      if (!requester) return null;

                      return (
                        <Card key={connection.id}>
                          <CardContent className="p-4 sm:p-5 md:p-6">
                            <div className="flex items-start gap-3 sm:gap-4">
                              <Link href={`/profile/${requester.id}`} className="flex-shrink-0">
                                <StorageAvatar
                                  src={requester.avatar_url}
                                  fallback={requester.full_name.split(' ').map(n => n[0]).join('')}
                                  className="h-10 w-10 sm:h-12 sm:w-12 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                                />
                              </Link>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <Link href={`/profile/${requester.id}`} className="hover:underline">
                                  <h3 className="font-semibold text-sm sm:text-base text-gray-100 capitalize truncate">{requester.full_name}</h3>
                                </Link>
                                {requester.bio && (
                                  <p className="text-xs sm:text-sm text-gray-400 mt-1 line-clamp-1 sm:line-clamp-2">{requester.bio}</p>
                                )}
                                <div className="flex gap-1.5 sm:gap-2 mt-3 sm:mt-4">
                                  <Button
                                    onClick={() => acceptConnection(connection.id)}
                                    size="sm"
                                    className="text-xs sm:text-sm px-2 sm:px-3"
                                  >
                                    <Check className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    <span className="truncate">Accept</span>
                                  </Button>
                                  <Button
                                    onClick={() => rejectConnection(connection.id)}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs sm:text-sm px-2 sm:px-3"
                                  >
                                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                                    <span className="truncate">Decline</span>
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}

                {sentRequests.length > 0 && (
                  <div className="space-y-3 sm:space-y-4">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-100">Sent Requests</h2>
                    {sentRequests.map((connection) => {
                      const recipient = connection.recipient;
                      if (!recipient) return null;

                      return (
                        <Card key={connection.id}>
                          <CardContent className="p-4 sm:p-5 md:p-6">
                            <div className="flex items-center gap-3 sm:gap-4">
                              <Link href={`/profile/${recipient.id}`} className="flex-shrink-0">
                                <StorageAvatar
                                  src={recipient.avatar_url}
                                  fallback={recipient.full_name.split(' ').map(n => n[0]).join('')}
                                  className="h-10 w-10 sm:h-12 sm:w-12 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                                />
                              </Link>
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <Link href={`/profile/${recipient.id}`} className="hover:underline">
                                  <h3 className="font-semibold text-sm sm:text-base text-gray-100 capitalize truncate">{recipient.full_name}</h3>
                                </Link>
                                <p className="text-xs sm:text-sm text-gray-500 truncate">Request pending</p>
                              </div>
                              <Button
                                onClick={() => cancelConnectionRequest(connection.id)}
                                variant="outline"
                                size="sm"
                                className="text-xs sm:text-sm px-2 sm:px-3 flex-shrink-0"
                              >
                                <span className="truncate">Cancel</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="following" className="space-y-4">
            {follows.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center space-y-3">
                    <div className="text-5xl">👥</div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-100 mb-1">Not following anyone yet</h3>
                      <p className="text-gray-400 text-sm">Follow entrepreneurs to see their updates in your feed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {follows.map((follow) => {
                  const following = follow.following;
                  if (!following) return null;

                  return (
                    <Card key={follow.id}>
                      <CardContent className="p-4 sm:p-5 md:p-6">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <Link href={`/profile/${following.id}`} className="flex-shrink-0">
                            <StorageAvatar
                              src={following.avatar_url}
                              fallback={following.full_name.split(' ').map(n => n[0]).join('')}
                              className="h-10 w-10 sm:h-12 sm:w-12 cursor-pointer hover:ring-2 hover:ring-amber-500 transition-all"
                            />
                          </Link>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <Link href={`/profile/${following.id}`} className="hover:underline">
                              <h3 className="font-semibold text-sm sm:text-base text-gray-100 truncate">
                                {following.full_name}
                              </h3>
                            </Link>
                            {following.stage && (
                              <Badge variant="secondary" className="mt-1 text-xs truncate max-w-[100px]">
                                {following.stage}
                              </Badge>
                            )}
                          </div>
                          <Button
                            onClick={() => unfollowUser(following.id)}
                            variant="outline"
                            size="sm"
                            className="text-xs sm:text-sm px-2 sm:px-3 flex-shrink-0"
                          >
                            <span className="truncate">Unfollow</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
