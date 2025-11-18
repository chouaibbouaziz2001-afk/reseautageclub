"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { useAuth } from '@/lib/auth-context';
import { useLoading } from '@/lib/loading-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SignIn() {
  const router = useRouter();
  const { login, user, loading: authLoading } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { toast } = useToast();
  const { startLoading, stopLoading } = useLoading();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/feed');
    }
  }, [user, authLoading, router]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  if (authLoading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto" />
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.email || !formData.password) {
      setError('Please enter both email and password');
      return;
    }

    if (!executeRecaptcha) {
      setError('reCAPTCHA not loaded. Please try again.');
      return;
    }

    setLoading(true);
    startLoading('Signing in...');
    try {
      const recaptchaToken = await executeRecaptcha('login');

      const verifyResponse = await fetch('/api/verify-recaptcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: recaptchaToken }),
      });

      const verifyData = await verifyResponse.json();

      if (!verifyData.success) {
        setError(verifyData.error || 'Security verification failed. Please try again.');
        setLoading(false);
        stopLoading();
        return;
      }

      await login(formData.email, formData.password);

      const { data: { user: authUser } } = await (await import('@/lib/supabase')).supabase.auth.getUser();
      if (authUser) {
        const { data: profile } = await (await import('@/lib/supabase')).supabase
          .from('profiles')
          .select('profile_completed')
          .eq('id', authUser.id)
          .maybeSingle();

        if (profile && !profile.profile_completed) {
          toast({
            title: "Complete Your Profile",
            description: "Please complete your profile to get started.",
          });
          setTimeout(() => router.push('/profile/setup'), 1500);
        } else {
          toast({
            title: "Welcome back!",
            description: "You've successfully signed in.",
          });
          setTimeout(() => router.push('/feed'), 1500);
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "Redirecting to feed...",
        });
        setTimeout(() => router.push('/feed'), 1500);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'Invalid credentials. Please check your email and password.');
      stopLoading();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center p-3 sm:p-4 no-h-scroll">
      <div className="w-full max-w-md space-y-3 sm:space-y-4">
        <Link href="/">
          <Button variant="ghost" className="gap-2 text-gray-300 hover:text-amber-400 hover:bg-gray-800">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
        <Card className="w-full bg-gray-900/80 border-gray-800 backdrop-blur-sm">
          <CardHeader className="space-y-3 sm:space-y-4 text-center p-4 sm:p-6">
            <div className="relative w-16 h-16 mx-auto rounded-lg overflow-hidden ring-2 ring-amber-500 shadow-lg shadow-amber-500/30">
              <Image
                src="/logo.jpg"
                alt="ReseautageClub Logo"
                fill
                className="object-cover"
                priority
              />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-100">Welcome Back</CardTitle>
            <CardDescription className="text-sm sm:text-base text-gray-400">
              Sign in to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing In...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            <p className="text-center text-sm text-gray-400">
              Don&apos;t have an account?{' '}
              <Link href="/sign-up" className="text-amber-400 hover:text-amber-300 hover:underline font-medium">
                Get Started
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
