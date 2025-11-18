'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useProfileCache, type CachedProfile } from '@/lib/profile-cache-context';

export function useProfile(userId?: string | null) {
  const { user: currentUser } = useAuth();
  const { getProfile, getCachedProfile, subscribeToProfile, unsubscribeFromProfile } = useProfileCache();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const targetUserId = userId || currentUser?.id;

  useEffect(() => {
    if (!targetUserId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    if (currentUser && targetUserId === currentUser.id) {
      setProfile({
        id: currentUser.id,
        full_name: currentUser.fullName,
        avatar_url: currentUser.avatarUrl,
        bio: currentUser.bio,
        location: currentUser.location,
        company: currentUser.company,
        position: currentUser.position,
        stage: currentUser.stage,
        skills: currentUser.skills,
        interests: currentUser.interests,
        looking_for: currentUser.lookingFor,
        followers_count: currentUser.followersCount,
        following_count: currentUser.followingCount,
        connections_count: currentUser.connectionsCount,
        profile_views_count: currentUser.profileViewsCount,
        email: currentUser.email,
        phone_number: currentUser.phoneNumber,
        profile_completed: currentUser.profileCompleted,
      });
      setLoading(false);
      return;
    }

    const cached = getCachedProfile(targetUserId);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    }

    subscribeToProfile(targetUserId);

    getProfile(targetUserId).then((fetchedProfile) => {
      if (fetchedProfile) {
        setProfile(fetchedProfile);
      }
      setLoading(false);
    });

    const checkInterval = setInterval(() => {
      const updated = getCachedProfile(targetUserId);
      if (updated && JSON.stringify(updated) !== JSON.stringify(profile)) {
        setProfile(updated);
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      if (targetUserId !== currentUser?.id) {
        unsubscribeFromProfile(targetUserId);
      }
    };
  }, [targetUserId, currentUser, getProfile, getCachedProfile, subscribeToProfile, unsubscribeFromProfile]);

  return { profile, loading };
}
