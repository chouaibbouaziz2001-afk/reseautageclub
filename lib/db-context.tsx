"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from './auth-context';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  profilePhotoUrl?: string;
  headline?: string;
  bio?: string;
  location?: string;
  businessStage?: string;
  currentCompany?: string;
  role?: string;
  industry?: string;
  yearsExperience?: number;
  skills?: string[];
  whatImWorkingOn?: string;
  lookingFor?: string[];
  linkedinUrl?: string;
  twitterHandle?: string;
  websiteUrl?: string;
  profileCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseContextType {
  profile: Profile | null;
  loading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Prevent duplicate loads
    if (loadingRef.current && lastUserIdRef.current === user.id) {
      return;
    }

    loadingRef.current = true;
    lastUserIdRef.current = user.id;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Failed to load profile:', error);
      } else if (data) {
        setProfile({
          id: data.id,
          userId: data.id,
          fullName: data.full_name || '',
          email: data.email || '',
          profilePhotoUrl: data.avatar_url,
          headline: data.headline,
          bio: data.bio,
          location: data.location,
          businessStage: data.business_stage,
          currentCompany: data.current_company,
          role: data.role,
          industry: data.industry,
          yearsExperience: data.years_experience,
          skills: data.skills,
          whatImWorkingOn: data.what_im_working_on,
          lookingFor: data.looking_for,
          linkedinUrl: data.linkedin_url,
          twitterHandle: data.twitter_handle,
          websiteUrl: data.website_url,
          profileCompleted: data.profile_completed || false,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
    setLoading(false);
    loadingRef.current = false;
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [user?.id]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user || !profile) {
      throw new Error('User or profile not found');
    }

    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
    if (updates.profilePhotoUrl !== undefined) dbUpdates.avatar_url = updates.profilePhotoUrl;
    if (updates.headline !== undefined) dbUpdates.headline = updates.headline;
    if (updates.bio !== undefined) dbUpdates.bio = updates.bio;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.businessStage !== undefined) dbUpdates.business_stage = updates.businessStage;
    if (updates.currentCompany !== undefined) dbUpdates.current_company = updates.currentCompany;
    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.industry !== undefined) dbUpdates.industry = updates.industry;
    if (updates.yearsExperience !== undefined) dbUpdates.years_experience = updates.yearsExperience;
    if (updates.skills !== undefined) dbUpdates.skills = updates.skills;
    if (updates.whatImWorkingOn !== undefined) dbUpdates.what_im_working_on = updates.whatImWorkingOn;
    if (updates.lookingFor !== undefined) dbUpdates.looking_for = updates.lookingFor;
    if (updates.linkedinUrl !== undefined) dbUpdates.linkedin_url = updates.linkedinUrl;
    if (updates.twitterHandle !== undefined) dbUpdates.twitter_handle = updates.twitterHandle;
    if (updates.websiteUrl !== undefined) dbUpdates.website_url = updates.websiteUrl;
    if (updates.profileCompleted !== undefined) dbUpdates.profile_completed = updates.profileCompleted;

    const { error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id);

    if (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setProfile(updatedProfile);
  }, [user, profile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile();
  }, [loadProfile]);

  const value = useMemo(
    () => ({ profile, loading, updateProfile, refreshProfile }),
    [profile, loading, updateProfile, refreshProfile]
  );

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
