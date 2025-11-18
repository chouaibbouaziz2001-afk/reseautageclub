"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  company?: string;
  position?: string;
  phoneNumber?: string;
  stage?: string;
  skills?: string[];
  interests?: string[];
  lookingFor?: string[];
  followersCount?: number;
  followingCount?: number;
  connectionsCount?: number;
  profileViewsCount?: number;
  profileCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const mapProfileToUser = useCallback((sessionUser: any, profile: any): User => {
    return {
      id: sessionUser.id,
      email: sessionUser.email!,
      fullName: profile?.full_name || sessionUser.email!.split('@')[0],
      avatarUrl: profile?.avatar_url || undefined,
      bio: profile?.bio || undefined,
      location: profile?.location || undefined,
      company: profile?.company || undefined,
      position: profile?.position || undefined,
      phoneNumber: profile?.phone_number || undefined,
      stage: profile?.stage || undefined,
      skills: profile?.skills || [],
      interests: profile?.interests || [],
      lookingFor: profile?.looking_for || [],
      followersCount: profile?.followers_count || 0,
      followingCount: profile?.following_count || 0,
      connectionsCount: profile?.connections_count || 0,
      profileViewsCount: profile?.profile_views_count || 0,
      profileCompleted: profile?.profile_completed || false,
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Add timeout to prevent hanging (reduced to 5s for faster feedback)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timeout - Supabase may be paused')), 5000);
        });

        const authPromise = supabase.auth.getSession();

        const { data: { session } } = await Promise.race([authPromise, timeoutPromise]) as any;

        if (!mounted) return;

        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (mounted) {
            setUser(mapProfileToUser(session.user, profile));
          }
        }
      } catch (error: any) {
        console.error('[AuthContext] Error initializing auth:', error);
        if (error.message?.includes('timeout') || error.message?.includes('paused')) {
          console.warn('⚠️ Supabase project may be paused. Please wake it up by visiting the Supabase dashboard.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          setUser(mapProfileToUser(session.user, profile));
        } else {
          setUser(null);
        }
      })();
    });

    let profileChannel: RealtimeChannel | null = null;

    const setupProfileSync = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        console.log('[AuthContext] Setting up Realtime sync for user:', session.user.id);

        profileChannel = supabase
          .channel(`profile-changes-${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${session.user.id}`
            },
            (payload) => {
              console.log('[AuthContext] Profile updated via Realtime:', payload.new);
              const updatedProfile = payload.new as any;
              setUser(prev => prev ? mapProfileToUser({ id: prev.id, email: prev.email }, updatedProfile) : null);
            }
          )
          .subscribe((status) => {
            console.log('[AuthContext] Realtime subscription status:', status);
          });
      }
    };

    setupProfileSync();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
    };
  }, [mapProfileToUser]);

  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) throw error;

    if (data.user) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile && !profileError) {
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            full_name: fullName,
            email: email,
            profile_completed: false,
          });

        if (insertError) {
          console.error('Failed to create profile:', insertError);
        }
      }

      const finalProfile = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .maybeSingle();

      setUser(mapProfileToUser(data.user, finalProfile.data));
    }
  }, [mapProfileToUser]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        if (error.message.includes('fetch')) {
          throw new Error('Network error. Please check your connection and try again.');
        }
        throw error;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        setUser(mapProfileToUser(data.user, profile));
      }
    } catch (err: any) {
      console.error('Login error details:', err);
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        throw new Error('Unable to connect to authentication server. Please check your internet connection.');
      }
      throw err;
    }
  }, [mapProfileToUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    console.log('[AuthContext] Refreshing user profile data');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      setUser(mapProfileToUser(session.user, profile));
      console.log('[AuthContext] User profile refreshed');
    }
  }, [mapProfileToUser]);

  const value = useMemo(
    () => ({ user, loading, login, signup, logout, refreshUser }),
    [user, loading, login, signup, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
