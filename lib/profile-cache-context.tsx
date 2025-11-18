'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface CachedProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  company?: string;
  position?: string;
  stage?: string;
  skills?: string[];
  interests?: string[];
  looking_for?: string[];
  followers_count?: number;
  following_count?: number;
  connections_count?: number;
  profile_views_count?: number;
  email?: string;
  phone_number?: string;
  profile_completed?: boolean;
  created_at?: string;
}

interface ProfileCacheContextType {
  getProfile: (userId: string) => Promise<CachedProfile | null>;
  refreshProfile: (userId: string) => Promise<void>;
  getCachedProfile: (userId: string) => CachedProfile | null;
  subscribeToProfile: (userId: string) => void;
  unsubscribeFromProfile: (userId: string) => void;
}

const ProfileCacheContext = createContext<ProfileCacheContextType | undefined>(undefined);

export function ProfileCacheProvider({ children }: { children: React.ReactNode }) {
  const [profileCache, setProfileCache] = useState<Map<string, CachedProfile>>(new Map());
  const [realtimeChannels, setRealtimeChannels] = useState<Map<string, RealtimeChannel>>(new Map());

  const getProfile = useCallback(async (userId: string): Promise<CachedProfile | null> => {
    const cached = profileCache.get(userId);
    if (cached) {
      console.log('[ProfileCache] Returning cached profile for:', userId);
      return cached;
    }

    console.log('[ProfileCache] Fetching profile for:', userId);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[ProfileCache] Error fetching profile:', error);
      return null;
    }

    if (profile) {
      setProfileCache(prev => new Map(prev).set(userId, profile as CachedProfile));
      return profile as CachedProfile;
    }

    return null;
  }, [profileCache]);

  const refreshProfile = useCallback(async (userId: string): Promise<void> => {
    console.log('[ProfileCache] Force refreshing profile for:', userId);
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error && profile) {
      setProfileCache(prev => new Map(prev).set(userId, profile as CachedProfile));
    }
  }, []);

  const getCachedProfile = useCallback((userId: string): CachedProfile | null => {
    return profileCache.get(userId) || null;
  }, [profileCache]);

  const subscribeToProfile = useCallback((userId: string) => {
    if (realtimeChannels.has(userId)) {
      console.log('[ProfileCache] Already subscribed to profile:', userId);
      return;
    }

    console.log('[ProfileCache] Subscribing to profile updates for:', userId);
    const channel = supabase
      .channel(`profile-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          console.log('[ProfileCache] Profile updated via Realtime:', userId, payload.new);
          setProfileCache(prev => new Map(prev).set(userId, payload.new as CachedProfile));
        }
      )
      .subscribe((status) => {
        console.log('[ProfileCache] Subscription status for', userId, ':', status);
      });

    setRealtimeChannels(prev => new Map(prev).set(userId, channel));
  }, [realtimeChannels]);

  const unsubscribeFromProfile = useCallback((userId: string) => {
    const channel = realtimeChannels.get(userId);
    if (channel) {
      console.log('[ProfileCache] Unsubscribing from profile:', userId);
      supabase.removeChannel(channel);
      setRealtimeChannels(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
    }
  }, [realtimeChannels]);

  useEffect(() => {
    return () => {
      console.log('[ProfileCache] Cleaning up all subscriptions');
      realtimeChannels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [realtimeChannels]);

  return (
    <ProfileCacheContext.Provider
      value={{
        getProfile,
        refreshProfile,
        getCachedProfile,
        subscribeToProfile,
        unsubscribeFromProfile,
      }}
    >
      {children}
    </ProfileCacheContext.Provider>
  );
}

export function useProfileCache() {
  const context = useContext(ProfileCacheContext);
  if (context === undefined) {
    throw new Error('useProfileCache must be used within a ProfileCacheProvider');
  }
  return context;
}
