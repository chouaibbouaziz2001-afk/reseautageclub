"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Users, Lock, Globe, Check, X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  category: string | null;
  is_private: boolean;
  creator_id: string;
  member_count: number;
  created_at: string;
  is_member?: boolean;
  user_role?: string;
}

const CATEGORIES = [
  'SaaS',
  'E-commerce',
  'Mobile Apps',
  'Web3 & Crypto',
  'AI & Machine Learning',
  'FinTech',
  'HealthTech',
  'EdTech',
  'FoodTech',
  'PropTech',
  'CleanTech',
  'AgriTech',
  'BioTech',
  'MarTech',
  'AdTech',
  'HRTech',
  'LegalTech',
  'InsurTech',
  'RetailTech',
  'TravelTech',
  'Logistics & Supply Chain',
  'Cybersecurity',
  'IoT & Hardware',
  'Gaming & Esports',
  'Social Media & Community',
  'Content & Media',
  'Music & Entertainment',
  'Fashion & Beauty',
  'Sports & Fitness',
  'Nonprofit & Social Impact',
  'Marketing & Growth',
  'Sales & Revenue',
  'Product Management',
  'Design & UX',
  'Engineering & Development',
  'Data & Analytics',
  'Customer Success',
  'Operations',
  'Fundraising & VC',
  'Startup Founders',
  'Side Projects',
  'Solopreneurs',
  'Remote Work',
  'Freelancing',
  'Other'
];

export default function Communities() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const { toast } = useToast();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myCommunities, setMyCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discover' | 'joined'>('discover');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    category: '',
    is_private: false
  });

  useEffect(() => {
    if (!user) {
      router.replace('/sign-in');
      return;
    }

    if (profile && !profile.profileCompleted) {
      router.replace('/profile/setup');
      return;
    }

    if (user && profile) {
      loadCommunities();
    }
  }, [user?.id, profile?.profileCompleted]);

  const loadCommunities = async () => {
    setLoading(true);

    // Load all accessible communities (RLS will filter out private ones user can't see)
    const { data: allCommunities } = await supabase
      .from('communities')
      .select('*')
      .order('member_count', { ascending: false });

    const { data: memberships } = await supabase
      .from('community_members')
      .select('community_id, role')
      .eq('user_id', user!.id);

    if (allCommunities && memberships) {
      const membershipMap = new Map(
        memberships.map(m => [m.community_id, m.role])
      );

      const enrichedCommunities = allCommunities.map(c => ({
        ...c,
        is_member: membershipMap.has(c.id),
        user_role: membershipMap.get(c.id)
      }));

      // For discover tab: show public communities + private ones where user is a member
      // For joined tab: show only communities where user is a member
      setCommunities(enrichedCommunities);
      setMyCommunities(enrichedCommunities.filter(c => c.is_member));
    }

    setLoading(false);
  };

  const createCommunity = async () => {
    if (!newCommunity.name.trim()) {
      toast({
        title: "Error",
        description: "Community name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data: community, error } = await supabase
        .from('communities')
        .insert({
          name: newCommunity.name.trim(),
          description: newCommunity.description.trim() || null,
          category: newCommunity.category || null,
          is_private: newCommunity.is_private,
          creator_id: user!.id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating community:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to create community",
          variant: "destructive"
        });
      } else {
        await supabase.from('community_members').insert({
          community_id: community.id,
          user_id: user!.id,
          role: 'admin'
        });

        toast({
          title: "Success",
          description: `${community.name} has been created.`
        });

        setCreateDialogOpen(false);
        setNewCommunity({ name: '', description: '', category: '', is_private: false });
        await loadCommunities();
        router.push(`/communities/${community.id}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    }
  };

  const joinCommunity = async (communityId: string) => {
    await supabase.from('community_members').insert({
      community_id: communityId,
      user_id: user!.id,
      role: 'member'
    });

    toast({
      title: "Joined!",
      description: "You've successfully joined this community"
    });

    // Realtime will handle updating the UI
  };

  const leaveCommunity = async (communityId: string) => {
    await supabase
      .from('community_members')
      .delete()
      .eq('community_id', communityId)
      .eq('user_id', user!.id);

    toast({
      title: "Left community",
      description: "You've left this community"
    });

    // Realtime will handle updating the UI
  };

  const filteredCommunities = communities.filter(c => {
    const matchesSearch = !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const displayCommunities = activeTab === 'joined' ? myCommunities : filteredCommunities;

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      {/* Header - Instagram Story Style */}
      <div className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800 safe-top">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="text-gray-400 hover:text-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-yellow-500 bg-clip-text text-transparent">
                Communities
              </h1>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold">
                  <Plus className="h-4 w-4 mr-1" />
                  Create
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle className="text-gray-100">Create a Community</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Build a community around a topic you're passionate about
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="name" className="text-gray-300">Community Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., SaaS Founders"
                      value={newCommunity.name}
                      onChange={(e) => setNewCommunity({ ...newCommunity, name: e.target.value })}
                      className="bg-gray-950 border-gray-700 text-gray-100 mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description" className="text-gray-300">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="What is this community about?"
                      value={newCommunity.description}
                      onChange={(e) => setNewCommunity({ ...newCommunity, description: e.target.value })}
                      rows={3}
                      className="bg-gray-950 border-gray-700 text-gray-100 mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="category" className="text-gray-300">Category</Label>
                    <Select
                      value={newCommunity.category}
                      onValueChange={(value) => setNewCommunity({ ...newCommunity, category: value })}
                    >
                      <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-100 mt-2">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700">
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat} className="text-gray-100">
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="private"
                      checked={newCommunity.is_private}
                      onChange={(e) => setNewCommunity({ ...newCommunity, is_private: e.target.checked })}
                      className="rounded border-gray-700"
                    />
                    <Label htmlFor="private" className="font-normal text-gray-300">
                      Make this community private
                    </Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="border-gray-700 text-gray-300">
                    Cancel
                  </Button>
                  <Button
                    onClick={createCommunity}
                    disabled={!newCommunity.name.trim()}
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold"
                  >
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
            <Input
              placeholder="Search communities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-900 border-gray-800 text-gray-100 placeholder:text-gray-500 h-10"
            />
          </div>

          {/* Tab Navigation - Instagram Style */}
          <div className="flex items-center border-b border-gray-800">
            <button
              onClick={() => setActiveTab('discover')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'discover'
                  ? 'text-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Discover
              {activeTab === 'discover' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('joined')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === 'joined'
                  ? 'text-amber-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              Joined {myCommunities.length > 0 && `(${myCommunities.length})`}
              {activeTab === 'joined' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-yellow-500" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Category Filter - Horizontal Scroll */}
      {activeTab === 'discover' && (
        <div className="sticky top-[180px] z-30 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 py-3">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                All
              </button>
              {CATEGORIES.slice(0, 15).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Communities Grid - Instagram Feed Style */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-gray-900/60 border-gray-800 animate-pulse">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 bg-gray-800 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-800 rounded w-1/3" />
                      <div className="h-3 bg-gray-800 rounded w-full" />
                      <div className="h-3 bg-gray-800 rounded w-2/3" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : displayCommunities.length === 0 ? (
          <Card className="bg-gray-900/60 border-gray-800">
            <CardContent className="py-16">
              <div className="text-center space-y-3">
                <div className="text-5xl">🔍</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-100 mb-1">
                    {activeTab === 'joined' ? 'No joined communities' : 'No communities found'}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {activeTab === 'joined'
                      ? 'Start exploring and join communities that interest you'
                      : 'Try adjusting your search or create a new community'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {displayCommunities.map((community) => (
              <Card
                key={community.id}
                className="bg-gray-900/60 border-gray-800 hover:bg-gray-900/80 transition-all cursor-pointer group"
                onClick={() => router.push(`/communities/${community.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <Avatar className="h-14 w-14 border-2 border-gray-800 ring-2 ring-amber-500/20 group-hover:ring-amber-500/40 transition-all">
                        <AvatarImage src={community.avatar_url || undefined} />
                        <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-600 text-gray-900 font-bold text-lg">
                          {community.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {community.is_member && (
                        <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full flex items-center justify-center border-2 border-gray-900">
                          <Check className="h-3 w-3 text-gray-900" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-semibold text-gray-100 truncate group-hover:text-amber-400 transition-colors">
                              {community.name}
                            </h3>
                            {community.is_private ? (
                              <Lock className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                            ) : (
                              <Globe className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                            <Users className="h-3.5 w-3.5" />
                            <span>{community.member_count} {community.member_count === 1 ? 'member' : 'members'}</span>
                            {community.category && (
                              <>
                                <span>•</span>
                                <span>{community.category}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Join/View Button */}
                        <div onClick={(e) => e.stopPropagation()}>
                          {community.is_member ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-gray-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/communities/${community.id}`);
                              }}
                            >
                              View
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold"
                              onClick={(e) => {
                                e.stopPropagation();
                                joinCommunity(community.id);
                              }}
                            >
                              Join
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Description */}
                      {community.description && (
                        <p className="text-sm text-gray-400 line-clamp-2">
                          {community.description}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
