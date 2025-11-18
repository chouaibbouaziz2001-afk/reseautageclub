'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Briefcase, MapPin, Clock, TrendingUp, Settings, Mail, CheckCircle, XCircle, Loader2, Heart, X as XIcon, Star, Shuffle, Home, ArrowLeft, Trash2, Upload, Video, Image as ImageIcon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StorageAvatar } from '@/components/storage-avatar';
import { StorageImage } from '@/components/storage-image';
import { StorageVideo } from '@/components/storage-video';
import { toast } from 'sonner';
import { uploadToUserMedia } from '@/lib/storage';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import { notificationHelpers } from '@/lib/notifications';

interface CofounderProfile {
  id: string;
  user_id: string;
  looking_for_cofounder: boolean;
  startup_idea: string;
  role_seeking: string[];
  industry: string;
  stage: string;
  commitment: string;
  location: string;
  remote_ok: boolean;
  equity_split: string;
  demo_video_url?: string | null;
  pitch_images?: string[];
  user?: {
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
  };
  skills?: Array<{ skill: string; level: string }>;
  interests?: Array<{ interest: string }>;
}

interface MatchRequest {
  id: string;
  user_id: string;
  matched_user_id: string;
  status: string;
  message: string;
  created_at: string;
  user?: {
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
  };
  matched_user?: {
    full_name: string;
    avatar_url: string | null;
    bio: string | null;
  };
}

export default function CofounderMatchPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<CofounderProfile[]>([]);
  const [myProfile, setMyProfile] = useState<CofounderProfile | null>(null);
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<CofounderProfile | null>(null);
  const [connectMessage, setConnectMessage] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterStage, setFilterStage] = useState('all');
  const [currentProfileIndex, setCurrentProfileIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [customIndustry, setCustomIndustry] = useState('');
  const [viewingProfile, setViewingProfile] = useState<CofounderProfile | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

  const [formData, setFormData] = useState({
    looking_for_cofounder: true,
    startup_idea: '',
    role_seeking: [] as string[],
    industry: '',
    stage: '',
    commitment: '',
    location: '',
    remote_ok: true,
    equity_split: '',
    skills: [] as Array<{ skill: string; level: string }>,
    interests: [] as string[],
    demo_video_url: null as string | null,
    pitch_images: [] as string[]
  });

  const [newSkill, setNewSkill] = useState({ skill: '', level: 'intermediate' });
  const [newInterest, setNewInterest] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const profilesChannel = supabase
      .channel('cofounder-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cofounder_profiles',
        },
        () => {
          loadProfiles();
        }
      )
      .subscribe();

    const matchesChannel = supabase
      .channel('cofounder-matches-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cofounder_matches',
        },
        () => {
          loadMatchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(matchesChannel);
    };
  }, [user]);

  useEffect(() => {
    if (user) {
      loadProfiles();
      setCurrentProfileIndex(0);
    }
  }, [filterIndustry, filterStage]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadMyProfile(),
      loadProfiles(),
      loadMatchRequests(),
      loadCurrentUserProfile()
    ]);
    setLoading(false);
  };

  const loadCurrentUserProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user!.id)
      .maybeSingle();

    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const loadMyProfile = async () => {
    const { data: profile, error } = await supabase
      .from('cofounder_profiles')
      .select(`
        *,
        skills:cofounder_skills(skill, level),
        interests:cofounder_interests(interest)
      `)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (error) {
      console.error('Error loading my profile:', error);
      setMyProfile(null);
      return;
    }

    if (profile) {
      setMyProfile(profile);
      setFormData({
        looking_for_cofounder: profile.looking_for_cofounder,
        startup_idea: profile.startup_idea || '',
        role_seeking: profile.role_seeking || [],
        industry: profile.industry || '',
        stage: profile.stage || '',
        commitment: profile.commitment || '',
        location: profile.location || '',
        remote_ok: profile.remote_ok,
        equity_split: profile.equity_split || '',
        skills: profile.skills || [],
        interests: profile.interests?.map((i: any) => i.interest) || [],
        demo_video_url: profile.demo_video_url || null,
        pitch_images: profile.pitch_images || []
      });
    } else {
      // No profile found - clear state
      setMyProfile(null);
      setFormData({
        looking_for_cofounder: true,
        startup_idea: '',
        role_seeking: [],
        industry: '',
        stage: '',
        commitment: '',
        location: '',
        remote_ok: true,
        equity_split: '',
        skills: [],
        interests: [],
        demo_video_url: null,
        pitch_images: []
      });
    }
  };

  const loadProfiles = async () => {
    console.log('🔍 Loading profiles for user:', user?.id);
    console.log('🔍 Filters - Industry:', filterIndustry, 'Stage:', filterStage);

    // SECURITY: Validate user ID is a valid UUID before using in query
    // Note: Supabase PostgREST validates UUIDs, but we validate here for defense in depth
    const userId = user!.id;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      console.error('Invalid user ID format');
      toast.error('Invalid user ID');
      return;
    }

    // First, get all users that the current user has already matched with (accepted or pending)
    // SECURITY: String interpolation is safe here because:
    // 1. userId is validated as UUID above
    // 2. Supabase PostgREST validates UUID format and rejects invalid input
    // 3. This is the only way to use .or() with multiple conditions in Supabase
    const { data: existingMatches } = await supabase
      .from('cofounder_matches')
      .select('user_id, matched_user_id')
      .or(`user_id.eq.${userId},matched_user_id.eq.${userId}`);

    // Extract user IDs to exclude
    const excludedUserIds = new Set<string>();
    if (existingMatches) {
      existingMatches.forEach(match => {
        if (match.user_id === user!.id) {
          excludedUserIds.add(match.matched_user_id);
        } else {
          excludedUserIds.add(match.user_id);
        }
      });
    }

    console.log('🚫 Excluding', excludedUserIds.size, 'already matched users');

    let query = supabase
      .from('cofounder_profiles')
      .select(`
        *,
        profiles!inner(full_name, avatar_url, bio),
        cofounder_skills(skill, level),
        cofounder_interests(interest)
      `)
      .eq('looking_for_cofounder', true)
      .neq('user_id', user!.id);

    if (filterIndustry !== 'all' && filterIndustry) {
      console.log('🔍 Applying industry filter:', filterIndustry);
      query = query.eq('industry', filterIndustry);
    }

    if (filterStage !== 'all' && filterStage) {
      console.log('🔍 Applying stage filter:', filterStage);
      query = query.eq('stage', filterStage);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading profiles:', error);
      toast.error('Failed to load profiles');
      setProfiles([]);
      return;
    }

    console.log('✅ Query result - Data:', data, 'Error:', error);
    console.log('✅ Profiles count before filtering:', data?.length || 0);

    if (data) {
      // Transform data to match expected structure and filter out already matched users
      const transformedData = data
        .filter(profile => !excludedUserIds.has(profile.user_id))
        .map((profile: any) => ({
          ...profile,
          user: profile.profiles,
          skills: profile.cofounder_skills || [],
          interests: profile.cofounder_interests || []
        }));

      console.log('✅ Setting profiles:', transformedData.length, 'profiles (after excluding matches)');
      setProfiles(transformedData);
      // Reset swipe index when new profiles are loaded
      if (transformedData.length > 0 && currentProfileIndex >= transformedData.length) {
        console.log('✅ Resetting index from', currentProfileIndex, 'to 0');
        setCurrentProfileIndex(0);
      }
      console.log('✅ Current index after load:', currentProfileIndex);
    } else {
      console.log('⚠️ No data returned, setting empty array');
      setProfiles([]);
    }
  };

  const loadMatchRequests = async () => {
    const { data: matches, error } = await supabase
      .from('cofounder_matches')
      .select('*')
      // SECURITY: Safe - user.id is validated as UUID in loadProfiles, Supabase PostgREST also validates
      .or(`user_id.eq.${user!.id},matched_user_id.eq.${user!.id}`)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('Error loading match requests:', error);
      return;
    }

    if (!matches) {
      setMatchRequests([]);
      return;
    }

    // Fetch profiles for all unique user IDs
    const allUserIds = matches.flatMap(m => [m.user_id, m.matched_user_id]);
    const userIds = Array.from(new Set(allUserIds));
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio')
      .in('id', userIds);

    if (profilesData) {
      const profilesMap = new Map(profilesData.map(p => [p.id, p]));

      const enrichedMatches = matches.map(match => ({
        ...match,
        user: profilesMap.get(match.user_id),
        matched_user: profilesMap.get(match.matched_user_id)
      }));

      console.log('Loaded match requests:', enrichedMatches.length);
      setMatchRequests(enrichedMatches);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video too large', {
        description: 'Please upload a video smaller than 50MB.'
      });
      return;
    }

    try {
      setUploadingVideo(true);
      toast.info('Uploading video...', {
        description: 'This may take a moment for large videos.'
      });

      const fileName = `${Date.now()}-${file.name}`;
      const result = await uploadToUserMedia(file, user.id, 'cofounder-videos', fileName, {
        compress: false
      });

      setFormData(prev => ({ ...prev, demo_video_url: result.url }));
      toast.success('Video uploaded successfully!');
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    const currentImages = formData.pitch_images.length;
    const remainingSlots = 4 - currentImages;

    if (files.length > remainingSlots) {
      toast.error('Too many images', {
        description: `You can only upload ${remainingSlots} more image(s). Maximum is 4.`
      });
      return;
    }

    try {
      setUploadingImages(true);
      toast.info('Compressing images...');

      // Compress images before upload with maximum compression
      const compressionPromises = Array.from(files).map(async (file) => {
        const settings = getCompressionSettings(file.size);
        const compressedFile = await compressImage(file, settings);

        const originalSizeKB = (file.size / 1024).toFixed(0);
        const compressedSizeKB = (compressedFile.size / 1024).toFixed(0);
        console.log(`Image: ${originalSizeKB}KB -> ${compressedSizeKB}KB (${((1 - compressedFile.size / file.size) * 100).toFixed(0)}% reduction)`);

        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
        return uploadToUserMedia(compressedFile, user.id, 'cofounder-images', fileName, {
          compress: false // Already compressed manually with aggressive settings
        });
      });

      const results = await Promise.all(compressionPromises);

      const urls = results.map(r => r.url);
      if (urls.length > 0) {
        setFormData(prev => ({
          ...prev,
          pitch_images: [...prev.pitch_images, ...urls]
        }));
        toast.success(`${urls.length} image(s) uploaded successfully!`, {
          description: 'Images optimized and compressed for storage'
        });
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      pitch_images: prev.pitch_images.filter((_, i) => i !== index)
    }));
  };

  const removeVideo = () => {
    setFormData(prev => ({ ...prev, demo_video_url: null }));
  };

  const saveProfile = async () => {
    if (isSaving) return;

    try {
      setIsSaving(true);
      console.log('Saving profile...');
      console.log('User ID:', user?.id);
      console.log('Form data:', formData);

      if (!user?.id) {
        toast.error('Not authenticated', {
          description: 'Please sign in to save your profile.'
        });
        setIsSaving(false);
        return;
      }

      const profileData = {
        user_id: user.id,
        looking_for_cofounder: formData.looking_for_cofounder,
        startup_idea: formData.startup_idea || '',
        role_seeking: formData.role_seeking || [],
        industry: formData.industry || '',
        stage: formData.stage || '',
        commitment: formData.commitment || '',
        location: formData.location || '',
        remote_ok: formData.remote_ok || false,
        equity_split: formData.equity_split || '',
        demo_video_url: formData.demo_video_url || null,
        pitch_images: formData.pitch_images || [],
        updated_at: new Date().toISOString()
      };

      console.log('Profile data to save:', profileData);

      const { data: profile, error } = await supabase
        .from('cofounder_profiles')
        .upsert(profileData, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      console.log('Upsert result:', { profile, error });

      if (error) {
        console.error('Error saving profile:', error);
        toast.error('Failed to save profile', {
          description: error.message || 'Please try again.'
        });
        setIsSaving(false);
        return;
      }

      if (!profile) {
        console.error('No profile returned');
        toast.error('Failed to save profile', {
          description: 'No profile data returned from server.'
        });
        setIsSaving(false);
        return;
      }

      console.log('Profile saved, updating skills and interests...');

      // Delete existing skills
      await supabase
        .from('cofounder_skills')
        .delete()
        .eq('profile_id', profile.id);

      // Insert new skills
      if (formData.skills.length > 0) {
        const { error: skillsError } = await supabase
          .from('cofounder_skills')
          .insert(formData.skills.map(s => ({
            profile_id: profile.id,
            skill: s.skill,
            level: s.level
          })));

        if (skillsError) {
          console.error('Error saving skills:', skillsError);
        }
      }

      // Delete existing interests
      await supabase
        .from('cofounder_interests')
        .delete()
        .eq('profile_id', profile.id);

      // Insert new interests
      if (formData.interests.length > 0) {
        const { error: interestsError } = await supabase
          .from('cofounder_interests')
          .insert(formData.interests.map(i => ({
            profile_id: profile.id,
            interest: i
          })));

        if (interestsError) {
          console.error('Error saving interests:', interestsError);
        }
      }

      console.log('Profile saved successfully!');
      toast.success('Profile saved successfully!');
      setEditDialogOpen(false);

      // Reset swipe index to show available profiles
      setCurrentProfileIndex(0);

      await loadData();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred', {
        description: 'Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProfile = async () => {
    if (isDeleting || !user?.id || !myProfile?.id) return;

    try {
      setIsDeleting(true);
      console.log('Deleting profile...');

      // Delete skills first (due to foreign key constraints)
      const { error: skillsError } = await supabase
        .from('cofounder_skills')
        .delete()
        .eq('profile_id', myProfile.id);

      if (skillsError) {
        console.error('Error deleting skills:', skillsError);
        toast.error('Failed to delete profile', {
          description: 'Error removing skills: ' + skillsError.message
        });
        setIsDeleting(false);
        return;
      }

      // Delete interests
      const { error: interestsError } = await supabase
        .from('cofounder_interests')
        .delete()
        .eq('profile_id', myProfile.id);

      if (interestsError) {
        console.error('Error deleting interests:', interestsError);
        toast.error('Failed to delete profile', {
          description: 'Error removing interests: ' + interestsError.message
        });
        setIsDeleting(false);
        return;
      }

      // Delete any pending match requests sent by this user
      await supabase
        .from('cofounder_matches')
        .delete()
        .eq('requester_id', user.id);

      // Delete any pending match requests received by this user
      await supabase
        .from('cofounder_matches')
        .delete()
        .eq('recipient_id', user.id);

      // Finally, delete the profile
      const { error: profileError } = await supabase
        .from('cofounder_profiles')
        .delete()
        .eq('id', myProfile.id);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        toast.error('Failed to delete profile', {
          description: profileError.message || 'Please try again.'
        });
        setIsDeleting(false);
        return;
      }

      console.log('Profile deleted successfully!');

      // Clear state immediately
      setMyProfile(null);

      // Reset form data
      setFormData({
        looking_for_cofounder: true,
        startup_idea: '',
        role_seeking: [],
        industry: '',
        stage: '',
        commitment: '',
        location: '',
        remote_ok: true,
        equity_split: '',
        skills: [],
        interests: [],
        demo_video_url: null,
        pitch_images: []
      });

      // Close dialogs
      setDeleteDialogOpen(false);
      setEditDialogOpen(false);

      // Reload data to confirm deletion
      await loadData();

      toast.success('Profile deleted successfully!');
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred', {
        description: 'Please try again.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const loadCofounderProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('cofounder_profiles')
      .select(`
        *,
        user:profiles!cofounder_profiles_user_id_fkey (
          full_name,
          avatar_url,
          bio
        )
      `)
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      setViewingProfile(data);
      setProfileDialogOpen(true);
    }
  };

  const sendMatchRequest = async () => {
    if (!selectedProfile || !connectMessage.trim() || !currentUserProfile) return;

    await supabase.from('cofounder_matches').insert({
      user_id: user!.id,
      matched_user_id: selectedProfile.user_id,
      message: connectMessage,
      status: 'pending'
    });

    // Send notification to the matched user
    await notificationHelpers.cofounderLike(
      user!.id,
      selectedProfile.user_id,
      currentUserProfile.full_name
    );

    setConnectDialogOpen(false);
    setConnectMessage('');
    setSelectedProfile(null);
    loadMatchRequests();
  };

  const respondToMatch = async (matchId: string, status: 'accepted' | 'rejected') => {
    if (!currentUserProfile) return;

    // Find the match request to get the requester's ID
    const matchRequest = matchRequests.find(m => m.id === matchId);

    await supabase
      .from('cofounder_matches')
      .update({ status })
      .eq('id', matchId);

    // Send notification if accepted
    if (status === 'accepted' && matchRequest) {
      await notificationHelpers.cofounderMatch(
        user!.id,
        matchRequest.user_id,
        currentUserProfile.full_name
      );
    }

    loadMatchRequests();
  };

  const addSkill = () => {
    if (newSkill.skill.trim()) {
      setFormData({
        ...formData,
        skills: [...formData.skills, newSkill]
      });
      setNewSkill({ skill: '', level: 'intermediate' });
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && !formData.interests.includes(newInterest)) {
      setFormData({
        ...formData,
        interests: [...formData.interests, newInterest]
      });
      setNewInterest('');
    }
  };

  const removeSkill = (index: number) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((_, i) => i !== index)
    });
  };

  const removeInterest = (interest: string) => {
    setFormData({
      ...formData,
      interests: formData.interests.filter(i => i !== interest)
    });
  };

  const openImageViewer = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageViewerOpen(true);
  };

  const toggleRole = (role: string) => {
    const roles = formData.role_seeking.includes(role)
      ? formData.role_seeking.filter(r => r !== role)
      : [...formData.role_seeking, role];
    setFormData({ ...formData, role_seeking: roles });
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (currentProfileIndex >= profiles.length || !currentUserProfile) return;

    const currentProfile = profiles[currentProfileIndex];
    setSwipeDirection(direction);

    if (direction === 'right') {
      await supabase.from('cofounder_matches').insert({
        user_id: user!.id,
        matched_user_id: currentProfile.user_id,
        message: 'Interested in connecting!',
        status: 'pending'
      });

      // Send notification to the swiped user
      await notificationHelpers.cofounderLike(
        user!.id,
        currentProfile.user_id,
        currentUserProfile.full_name
      );
    }

    setTimeout(() => {
      setSwipeDirection(null);
      setCurrentProfileIndex(currentProfileIndex + 1);
    }, 300);
  };

  const resetSwipe = () => {
    setCurrentProfileIndex(0);
    loadProfiles();
  };

  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/sign-in');
    }
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const sentRequests = matchRequests.filter(m => m.user_id === user.id);
  const receivedRequests = matchRequests.filter(m => m.matched_user_id === user.id && m.status === 'pending');
  const acceptedMatches = matchRequests.filter(m => m.status === 'accepted');

  console.log('🎨 RENDER - Profiles:', profiles.length, 'Current Index:', currentProfileIndex);
  console.log('🎨 RENDER - Show "All caught up"?', currentProfileIndex >= profiles.length);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 sm:py-6">
          <Link href="/feed">
            <Button variant="ghost" className="mb-3 sm:mb-4 -ml-2 hover:bg-gray-800 text-sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Feed
            </Button>
          </Link>
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-1 sm:mb-2">Co-founder Matching</h1>
            <p className="text-sm sm:text-base text-gray-400">Find the perfect co-founder for your startup journey</p>
          </div>
        </div>

        <Tabs defaultValue="discover" className="space-y-4 sm:space-y-6">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start sm:justify-center">
            <TabsTrigger value="discover" className="text-xs sm:text-sm">
              <Shuffle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Swipe</span>
              <span className="sm:hidden">Swipe</span>
            </TabsTrigger>
            <TabsTrigger value="browse" className="text-xs sm:text-sm">
              <Users className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span>Browse</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="text-xs sm:text-sm">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Requests</span>
              <span className="sm:hidden">Req</span>
              {receivedRequests.length > 0 && ` (${receivedRequests.length})`}
            </TabsTrigger>
            <TabsTrigger value="matches" className="text-xs sm:text-sm">
              <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span>Matches</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs sm:text-sm">
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">My Profile</span>
              <span className="sm:hidden">Profile</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-4 sm:space-y-6">
            {currentProfileIndex >= profiles.length ? (
              <Card>
                <CardContent className="py-12 sm:py-16 text-center px-4">
                  <CheckCircle className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 mx-auto mb-3 sm:mb-4" />
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-100 mb-2">All caught up!</h3>
                  <p className="text-sm sm:text-base text-gray-400 mb-4 sm:mb-6">
                    You've seen all available profiles. Already matched profiles won't show up here anymore!
                  </p>
                  <Button onClick={resetSwipe} size="sm" className="sm:size-default">
                    <Shuffle className="h-4 w-4 mr-2" />
                    Start Over
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="max-w-2xl mx-auto px-2 sm:px-0">
                <Card className={`relative overflow-hidden transition-all duration-300 ${
                  swipeDirection === 'right' ? 'translate-x-8 opacity-75' :
                  swipeDirection === 'left' ? '-translate-x-8 opacity-75' : ''
                }`}>
                  <CardContent className="p-0">
                    <div className="relative">
                      <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-10 bg-white/90 backdrop-blur-sm rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm font-medium text-gray-700">
                        {currentProfileIndex + 1} / {profiles.length}
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-4 sm:p-6 lg:p-8">
                        <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                          <StorageAvatar
                            src={profiles[currentProfileIndex].user?.avatar_url}
                            fallback={profiles[currentProfileIndex].user?.full_name.split(' ').map(n => n[0]).join('')}
                            className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 border-2 sm:border-4 border-white shadow-lg flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 truncate">
                              {profiles[currentProfileIndex].user?.full_name}
                            </h2>
                            {profiles[currentProfileIndex].user?.bio && (
                              <p className="text-sm sm:text-base text-gray-700 line-clamp-2">{profiles[currentProfileIndex].user?.bio}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                          <Badge className="bg-amber-500 text-xs sm:text-sm">{profiles[currentProfileIndex].industry}</Badge>
                          <Badge variant="secondary" className="text-xs sm:text-sm">{profiles[currentProfileIndex].stage}</Badge>
                          <Badge variant="outline" className="text-xs sm:text-sm">{profiles[currentProfileIndex].commitment}</Badge>
                        </div>
                      </div>

                      <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
                        <div>
                          <h3 className="font-semibold text-gray-100 mb-2 flex items-center gap-2 text-sm sm:text-base">
                            <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                            Startup Idea
                          </h3>
                          <p className="text-sm sm:text-base text-gray-300">{profiles[currentProfileIndex].startup_idea}</p>
                        </div>

                        {profiles[currentProfileIndex].role_seeking && profiles[currentProfileIndex].role_seeking!.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-gray-100 mb-2 flex items-center gap-2 text-sm sm:text-base">
                              <Users className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                              Looking for
                            </h3>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {profiles[currentProfileIndex].role_seeking!.map((role) => (
                                <Badge key={role} variant="secondary" className="text-xs sm:text-sm">{role}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {profiles[currentProfileIndex].skills && profiles[currentProfileIndex].skills!.length > 0 && (
                          <div>
                            <h3 className="font-semibold text-gray-100 mb-2 flex items-center gap-2 text-sm sm:text-base">
                              <Star className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                              Skills
                            </h3>
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {profiles[currentProfileIndex].skills!.map((s, i) => (
                                <Badge key={i} variant="outline" className="text-xs sm:text-sm">{s.skill} ({s.level})</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {(profiles[currentProfileIndex].demo_video_url || (profiles[currentProfileIndex].pitch_images && profiles[currentProfileIndex].pitch_images!.length > 0)) && (
                          <div className="border-t border-gray-700 pt-4 space-y-4">
                            <h3 className="font-semibold text-gray-100 flex items-center gap-2 text-sm sm:text-base">
                              <Video className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500 flex-shrink-0" />
                              Pitch Materials
                            </h3>

                            {profiles[currentProfileIndex].demo_video_url && (
                              <div>
                                <StorageVideo src={profiles[currentProfileIndex].demo_video_url!} className="w-full rounded-lg" />
                              </div>
                            )}

                            {profiles[currentProfileIndex].pitch_images && profiles[currentProfileIndex].pitch_images!.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {profiles[currentProfileIndex].pitch_images!.map((url: string, i: number) => (
                                  <div
                                    key={i}
                                    onClick={() => openImageViewer(url)}
                                    className="cursor-pointer hover:opacity-80 transition-opacity"
                                  >
                                    <StorageImage
                                      src={url}
                                      alt={`Pitch ${i + 1}`}
                                      className="w-full h-32 object-cover rounded-lg"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                          <div className="flex items-center gap-2 text-gray-400">
                            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">
                              {profiles[currentProfileIndex].location || 'Not specified'}
                              {profiles[currentProfileIndex].remote_ok && ' • Remote OK'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                            <span className="truncate">{profiles[currentProfileIndex].equity_split || 'Negotiable'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-center gap-4 sm:gap-6 mt-6 sm:mt-8">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => handleSwipe('left')}
                  >
                    <XIcon className="h-6 w-6 sm:h-8 sm:w-8" />
                  </Button>
                  <Button
                    size="lg"
                    className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 shadow-lg"
                    onClick={() => handleSwipe('right')}
                  >
                    <Heart className="h-8 w-8 sm:h-10 sm:w-10" />
                  </Button>
                </div>

                <p className="text-center text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4">
                  Tap ❤️ to connect or ✕ to pass
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="browse" className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label>Industry</Label>
                    <Select value={filterIndustry} onValueChange={(value) => {
                      setFilterIndustry(value);
                      setTimeout(loadProfiles, 100);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Industries</SelectItem>
                        <SelectItem value="Tech">Tech</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Finance">Finance</SelectItem>
                        <SelectItem value="E-commerce">E-commerce</SelectItem>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>Stage</Label>
                    <Select value={filterStage} onValueChange={(value) => {
                      setFilterStage(value);
                      setTimeout(loadProfiles, 100);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        <SelectItem value="Idea">Idea</SelectItem>
                        <SelectItem value="MVP">MVP</SelectItem>
                        <SelectItem value="Launched">Launched</SelectItem>
                        <SelectItem value="Growth">Growth</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {profiles.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">No co-founders found</h3>
                  <p className="text-gray-400">Try adjusting your filters or check back later. Already matched profiles are hidden from this list.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profiles.map((profile) => (
                  <Card key={profile.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-start gap-4">
                        <StorageAvatar
                          src={profile.user?.avatar_url}
                          fallback={profile.user?.full_name.split(' ').map(n => n[0]).join('')}
                          className="h-16 w-16"
                        />
                        <div className="flex-1">
                          <CardTitle className="text-xl mb-1 capitalize">{profile.user?.full_name}</CardTitle>
                          {profile.user?.bio && (
                            <p className="text-sm text-gray-400 mb-2">{profile.user.bio}</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">{profile.industry}</Badge>
                            <Badge variant="outline">{profile.stage}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-sm text-gray-300 mb-2">Startup Idea</h4>
                        <p className="text-sm text-gray-400">{profile.startup_idea}</p>
                      </div>

                      {profile.role_seeking && profile.role_seeking.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-300 mb-2">Looking for</h4>
                          <div className="flex flex-wrap gap-2">
                            {profile.role_seeking.map((role) => (
                              <Badge key={role} variant="secondary">{role}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {profile.skills && profile.skills.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-sm text-gray-300 mb-2">Skills</h4>
                          <div className="flex flex-wrap gap-2">
                            {profile.skills.map((s, i) => (
                              <Badge key={i} variant="outline">{s.skill}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {(profile.demo_video_url || (profile.pitch_images && profile.pitch_images.length > 0)) && (
                        <div className="border-t border-gray-700 pt-4 space-y-3">
                          <h4 className="font-semibold text-sm text-gray-300 flex items-center gap-2">
                            <Video className="h-4 w-4 text-amber-500" />
                            Pitch Materials
                          </h4>

                          {profile.demo_video_url && (
                            <StorageVideo src={profile.demo_video_url} className="w-full rounded-lg max-h-48" />
                          )}

                          {profile.pitch_images && profile.pitch_images.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {profile.pitch_images.slice(0, 2).map((url: string, i: number) => (
                                <div
                                  key={i}
                                  onClick={() => openImageViewer(url)}
                                  className="cursor-pointer hover:opacity-80 transition-opacity"
                                >
                                  <StorageImage
                                    src={url}
                                    alt={`Pitch ${i + 1}`}
                                    className="w-full h-24 object-cover rounded-lg"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {profile.pitch_images && profile.pitch_images.length > 2 && (
                            <p className="text-xs text-gray-400">+{profile.pitch_images.length - 2} more image(s)</p>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {profile.location || 'Not specified'} {profile.remote_ok && '• Remote OK'}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {profile.commitment}
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4" />
                          {profile.equity_split}
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        onClick={() => {
                          setSelectedProfile(profile);
                          setConnectDialogOpen(true);
                        }}
                        disabled={sentRequests.some(r => r.matched_user_id === profile.user_id)}
                      >
                        {sentRequests.some(r => r.matched_user_id === profile.user_id) ? 'Request Sent' : 'Connect'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {receivedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">No pending requests</h3>
                  <p className="text-gray-400">Connection requests will appear here</p>
                </CardContent>
              </Card>
            ) : (
              receivedRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <StorageAvatar
                        src={request.user?.avatar_url}
                        fallback={request.user?.full_name.split(' ').map(n => n[0]).join('')}
                        className="h-12 w-12"
                      />
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-100 mb-1 capitalize">{request.user?.full_name}</h3>
                        {request.user?.bio && (
                          <p className="text-sm text-gray-400 mb-3">{request.user.bio}</p>
                        )}
                        <div className="bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 rounded-lg p-4 mb-4">
                          <p className="text-sm text-gray-300">{request.message}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => respondToMatch(request.id, 'accepted')}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Accept
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => respondToMatch(request.id, 'rejected')}>
                            <XCircle className="h-4 w-4 mr-2" />
                            Decline
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            {acceptedMatches.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-100 mb-2">No matches yet</h3>
                  <p className="text-gray-400">Start connecting with potential co-founders</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedMatches.map((match) => {
                  const otherUser = match.user_id === user.id ? match.matched_user : match.user;
                  const otherUserId = match.user_id === user.id ? match.matched_user_id : match.user_id;
                  return (
                    <Card key={match.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <StorageAvatar
                            src={otherUser?.avatar_url}
                            fallback={otherUser?.full_name.split(' ').map(n => n[0]).join('')}
                            className="h-12 w-12"
                          />
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-100 capitalize">{otherUser?.full_name}</h3>
                            {otherUser?.bio && (
                              <p className="text-sm text-gray-400">{otherUser.bio}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => loadCofounderProfile(otherUserId)}
                          >
                            <Users className="h-4 w-4 mr-2" />
                            View Profile
                          </Button>
                          <Button
                            className="flex-1"
                            onClick={() => router.push(`/cofounder-match/chat/${match.id}`)}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Message
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Co-founder Profile</CardTitle>
                <CardDescription>
                  {myProfile ? 'Update your profile to attract the right co-founder' : 'Create your profile to start finding co-founders'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {myProfile ? (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 rounded-lg">
                      <div>
                        <h3 className="font-semibold text-gray-100 mb-1">Profile Status</h3>
                        <p className="text-sm text-gray-400">
                          {myProfile.looking_for_cofounder ? 'Actively looking for a co-founder' : 'Not looking currently'}
                        </p>
                      </div>
                      <Button onClick={() => setEditDialogOpen(true)}>
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Profile
                      </Button>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-100 mb-2">Startup Idea</h4>
                      <p className="text-gray-300">{myProfile.startup_idea}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-gray-100 mb-2">Looking for</h4>
                      <div className="flex flex-wrap gap-2">
                        {myProfile.role_seeking?.map((role) => (
                          <Badge key={role} variant="secondary">{role}</Badge>
                        ))}
                      </div>
                    </div>

                    {myProfile.skills && myProfile.skills.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-2">My Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {myProfile.skills.map((s: any, i: number) => (
                            <Badge key={i} variant="outline">{s.skill} - {s.level}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {myProfile.interests && myProfile.interests.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-2">Interests</h4>
                        <div className="flex flex-wrap gap-2">
                          {myProfile.interests.map((i: any) => (
                            <Badge key={i.interest}>{i.interest}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-1">Industry</h4>
                        <p className="text-gray-300">{myProfile.industry}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-1">Stage</h4>
                        <p className="text-gray-300">{myProfile.stage}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-1">Commitment</h4>
                        <p className="text-gray-300">{myProfile.commitment}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-100 mb-1">Equity Split</h4>
                        <p className="text-gray-300">{myProfile.equity_split}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-100 mb-2">Create Your Profile</h3>
                    <p className="text-gray-400 mb-6">Set up your co-founder profile to start matching</p>
                    <Button onClick={() => setEditDialogOpen(true)}>
                      Create Profile
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{myProfile ? 'Edit' : 'Create'} Co-founder Profile</DialogTitle>
            <DialogDescription>
              Tell potential co-founders about your startup vision
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Startup Idea *</Label>
              <Textarea
                value={formData.startup_idea}
                onChange={(e) => setFormData({ ...formData, startup_idea: e.target.value })}
                placeholder="Briefly describe your startup idea..."
                rows={3}
              />
            </div>

            <div>
              <Label>Looking for (Roles) *</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['CTO', 'CMO', 'CFO', 'COO', 'Technical Co-founder', 'Business Co-founder', 'Product Lead', 'Sales Lead'].map((role) => (
                  <Badge
                    key={role}
                    variant={formData.role_seeking.includes(role) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRole(role)}
                  >
                    {role}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Industry *</Label>
                <Select value={formData.industry === customIndustry && customIndustry ? 'custom' : formData.industry} onValueChange={(value) => {
                  if (value === 'custom') {
                    setFormData({ ...formData, industry: '' });
                  } else {
                    setFormData({ ...formData, industry: value });
                    setCustomIndustry('');
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tech">Tech</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Finance">Finance</SelectItem>
                    <SelectItem value="E-commerce">E-commerce</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="SaaS">SaaS</SelectItem>
                    <SelectItem value="AI/ML">AI/ML</SelectItem>
                    <SelectItem value="Blockchain">Blockchain</SelectItem>
                    <SelectItem value="CleanTech">CleanTech</SelectItem>
                    <SelectItem value="custom">Other (Custom)</SelectItem>
                  </SelectContent>
                </Select>
                {(formData.industry === '' || (customIndustry && formData.industry === customIndustry)) && (
                  <Input
                    value={customIndustry || formData.industry}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomIndustry(value);
                      setFormData({ ...formData, industry: value });
                    }}
                    placeholder="Enter your industry..."
                    className="mt-2"
                  />
                )}
              </div>

              <div>
                <Label>Stage *</Label>
                <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Idea">Idea</SelectItem>
                    <SelectItem value="MVP">MVP</SelectItem>
                    <SelectItem value="Launched">Launched</SelectItem>
                    <SelectItem value="Growth">Growth</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Commitment *</Label>
                <Select value={formData.commitment} onValueChange={(value) => setFormData({ ...formData, commitment: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Full-time">Full-time</SelectItem>
                    <SelectItem value="Part-time">Part-time</SelectItem>
                    <SelectItem value="Flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Equity Split</Label>
                <Input
                  value={formData.equity_split}
                  onChange={(e) => setFormData({ ...formData, equity_split: e.target.value })}
                  placeholder="e.g., 50/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location</Label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="City, Country"
                />
              </div>

              <div className="flex items-center gap-2 mt-7">
                <input
                  type="checkbox"
                  id="remote_ok"
                  checked={formData.remote_ok}
                  onChange={(e) => setFormData({ ...formData, remote_ok: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="remote_ok" className="cursor-pointer">Remote OK</Label>
              </div>
            </div>

            <div>
              <Label>Skills</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newSkill.skill}
                  onChange={(e) => setNewSkill({ ...newSkill, skill: e.target.value })}
                  placeholder="Add a skill..."
                />
                <Select value={newSkill.level} onValueChange={(value) => setNewSkill({ ...newSkill, level: value })}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={addSkill}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((s, i) => (
                  <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => removeSkill(i)}>
                    {s.skill} ({s.level}) ×
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Interests</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  placeholder="Add an interest..."
                />
                <Button type="button" onClick={addInterest}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.interests.map((interest) => (
                  <Badge key={interest} className="cursor-pointer" onClick={() => removeInterest(interest)}>
                    {interest} ×
                  </Badge>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4 space-y-4">
              <h4 className="font-semibold text-gray-100 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-amber-500" />
                Pitch Materials
              </h4>

              <div>
                <Label>Demo Video (Optional)</Label>
                <p className="text-xs text-gray-400 mb-2">Upload a short video demo of your startup (max 50MB)</p>
                {formData.demo_video_url ? (
                  <div className="relative">
                    <StorageVideo src={formData.demo_video_url} className="w-full rounded-lg" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={removeVideo}
                      className="absolute top-2 right-2"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      id="video-upload"
                      disabled={uploadingVideo}
                    />
                    <label htmlFor="video-upload">
                      <Button type="button" variant="outline" asChild disabled={uploadingVideo}>
                        <span className="cursor-pointer">
                          {uploadingVideo ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Video className="h-4 w-4 mr-2" />
                              Upload Video
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              <div>
                <Label>Pitch Images (Optional)</Label>
                <p className="text-xs text-gray-400 mb-2">Upload up to 4 images (screenshots, mockups, pitch deck slides)</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {formData.pitch_images.map((url, index) => (
                    <div key={index} className="relative group">
                      <StorageImage src={url} alt={`Pitch ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                {formData.pitch_images.length < 4 && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                      disabled={uploadingImages}
                    />
                    <label htmlFor="image-upload">
                      <Button type="button" variant="outline" asChild disabled={uploadingImages}>
                        <span className="cursor-pointer">
                          {uploadingImages ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Upload Images ({formData.pitch_images.length}/4)
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="looking"
                checked={formData.looking_for_cofounder}
                onChange={(e) => setFormData({ ...formData, looking_for_cofounder: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="looking" className="cursor-pointer">Actively looking for a co-founder</Label>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 flex justify-start">
              {myProfile && (
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isSaving || isDeleting}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Profile
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete your co-founder profile,
                        including all your skills, interests, and match requests.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          deleteProfile();
                        }}
                        disabled={isDeleting}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {isDeleting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          'Delete Profile'
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={isSaving || isDeleting}>
                Cancel
              </Button>
              <Button onClick={saveProfile} disabled={isSaving || isDeleting}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Profile'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Connection Request</DialogTitle>
            <DialogDescription>
              Introduce yourself to {selectedProfile?.user?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Message</Label>
            <Textarea
              value={connectMessage}
              onChange={(e) => setConnectMessage(e.target.value)}
              placeholder="Tell them why you'd be a great co-founder..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>Cancel</Button>
            <Button onClick={sendMatchRequest} disabled={!connectMessage.trim()}>Send Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <StorageAvatar
                src={viewingProfile?.user?.avatar_url}
                fallback={viewingProfile?.user?.full_name.split(' ').map(n => n[0]).join('')}
                className="h-16 w-16"
              />
              <div>
                <DialogTitle className="text-2xl capitalize">{viewingProfile?.user?.full_name}</DialogTitle>
                {viewingProfile?.user?.bio && (
                  <DialogDescription className="text-base mt-1">{viewingProfile.user.bio}</DialogDescription>
                )}
              </div>
            </div>
          </DialogHeader>

          {viewingProfile && (
            <div className="space-y-6 mt-4">
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary" className="text-sm py-1 px-3">
                  <Briefcase className="h-4 w-4 mr-1" />
                  {viewingProfile.industry}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  {viewingProfile.stage}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <MapPin className="h-4 w-4 mr-1" />
                  {viewingProfile.location}
                  {viewingProfile.remote_ok && ' (Remote OK)'}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3">
                  <Clock className="h-4 w-4 mr-1" />
                  {viewingProfile.commitment}
                </Badge>
              </div>

              <div>
                <h4 className="font-semibold text-gray-100 mb-2 flex items-center">
                  <Star className="h-4 w-4 mr-2 text-amber-500" />
                  Startup Idea
                </h4>
                <p className="text-gray-300 bg-gray-800 rounded-lg p-4">{viewingProfile.startup_idea}</p>
              </div>

              <div>
                <h4 className="font-semibold text-gray-100 mb-3 flex items-center">
                  <Users className="h-4 w-4 mr-2 text-amber-500" />
                  Looking For
                </h4>
                <div className="flex flex-wrap gap-2">
                  {viewingProfile.role_seeking?.map((role) => (
                    <Badge key={role} variant="secondary" className="text-sm">{role}</Badge>
                  ))}
                </div>
              </div>

              {viewingProfile.skills && viewingProfile.skills.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-100 mb-3">Skills & Expertise</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.skills.map((s: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-sm">
                        {s.skill} - {s.level}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {viewingProfile.interests && viewingProfile.interests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-100 mb-3">Interests</h4>
                  <div className="flex flex-wrap gap-2">
                    {viewingProfile.interests.map((interest: any, i: number) => (
                      <Badge key={i} className="text-sm bg-gradient-to-r from-amber-500 to-yellow-500">
                        {interest.interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {(viewingProfile.demo_video_url || (viewingProfile.pitch_images && viewingProfile.pitch_images.length > 0)) && (
                <div className="border-t border-gray-700 pt-6 space-y-4">
                  <h4 className="font-semibold text-gray-100 mb-3 flex items-center">
                    <Video className="h-4 w-4 mr-2 text-amber-500" />
                    Pitch Materials
                  </h4>

                  {viewingProfile.demo_video_url && (
                    <div>
                      <Label className="text-gray-300 mb-2 block">Demo Video</Label>
                      <StorageVideo src={viewingProfile.demo_video_url} className="w-full rounded-lg" />
                    </div>
                  )}

                  {viewingProfile.pitch_images && viewingProfile.pitch_images.length > 0 && (
                    <div>
                      <Label className="text-gray-300 mb-2 block">Pitch Images</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {viewingProfile.pitch_images.map((url: string, i: number) => (
                          <div
                            key={i}
                            onClick={() => openImageViewer(url)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <StorageImage
                              src={url}
                              alt={`Pitch ${i + 1}`}
                              className="w-full h-32 object-cover rounded-lg"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                <div>
                  <h4 className="font-semibold text-gray-100 mb-2">Equity Split</h4>
                  <p className="text-gray-300">{viewingProfile.equity_split}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-100 mb-2">Status</h4>
                  <p className="text-gray-300">
                    {viewingProfile.looking_for_cofounder ? (
                      <span className="text-green-400">● Actively Looking</span>
                    ) : (
                      <span className="text-gray-400">● Not Looking</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setProfileDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={imageViewerOpen} onOpenChange={setImageViewerOpen}>
        <DialogContent className="max-w-4xl w-full p-0 overflow-hidden">
          <div className="relative bg-black">
            <button
              onClick={() => setImageViewerOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
            >
              <XIcon className="h-6 w-6" />
            </button>
            <StorageImage
              src={selectedImageUrl}
              alt="Full size image"
              className="w-full h-auto max-h-[90vh] object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}