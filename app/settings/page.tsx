"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Lock, User, Mail, Phone, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { BUSINESS_STAGES, validateEmail, validatePhoneNumber, validateStage, normalizePhoneNumber, formatPhoneNumber } from '@/lib/validation';

interface ProfileData {
  full_name: string;
  email: string;
  phone_number: string;
  bio: string;
  stage: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone_number: '',
    bio: '',
    stage: '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [stageError, setStageError] = useState('');

  useEffect(() => {
    if (!user) {
      router.replace('/sign-in');
      return;
    }

    loadProfileData();
  }, [user, router]);

  const loadProfileData = async () => {
    if (!user) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email, phone_number, bio, stage')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setProfileData({
          full_name: profile.full_name || '',
          email: profile.email || user.email,
          phone_number: profile.phone_number || '',
          bio: profile.bio || '',
          stage: profile.stage || '',
        });
      } else {
        setProfileData(prev => ({ ...prev, email: user.email }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setError('');
    setSuccess('');
    setEmailError('');
    setPhoneError('');
    setStageError('');
    setSaving(true);

    try {
      if (profileData.email) {
        const emailValidation = validateEmail(profileData.email);
        if (!emailValidation.isValid) {
          setEmailError(emailValidation.error || '');
          setError(emailValidation.error || 'Invalid email');
          setSaving(false);
          return;
        }
      }

      if (profileData.phone_number) {
        const phoneValidation = validatePhoneNumber(profileData.phone_number);
        if (!phoneValidation.isValid) {
          setPhoneError(phoneValidation.error || '');
          setError(phoneValidation.error || 'Invalid phone number');
          setSaving(false);
          return;
        }
      }

      if (profileData.stage) {
        const stageValidation = validateStage(profileData.stage);
        if (!stageValidation.isValid) {
          setStageError(stageValidation.error || '');
          setError(stageValidation.error || 'Invalid stage');
          setSaving(false);
          return;
        }
      }

      const normalizedPhone = profileData.phone_number ? normalizePhoneNumber(profileData.phone_number) : null;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          email: profileData.email,
          phone_number: normalizedPhone,
          bio: profileData.bio,
          stage: profileData.stage,
        })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      setSuccess('Profile updated successfully');
      toast({
        title: "Success",
        description: "Your profile has been updated",
      });
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
      toast({
        title: "Error",
        description: error.message || 'Failed to update profile',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSaving(true);

    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (passwordError) throw passwordError;

      setSuccess('Password changed successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      toast({
        title: "Success",
        description: "Your password has been changed",
      });
    } catch (error: any) {
      setError(error.message || 'Failed to change password');
      toast({
        title: "Error",
        description: error.message || 'Failed to change password',
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="hover:bg-gray-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-100">Settings</h1>
          <p className="text-gray-400 mt-2">Manage your account settings and preferences</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-500 text-green-700">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and profile information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  onChange={(e) => {
                    setProfileData({ ...profileData, email: e.target.value });
                    setEmailError('');
                  }}
                  onBlur={(e) => {
                    if (e.target.value) {
                      const validation = validateEmail(e.target.value);
                      if (!validation.isValid) {
                        setEmailError(validation.error || '');
                      }
                    }
                  }}
                  placeholder="john@example.com"
                  className={emailError ? 'border-red-500' : ''}
                />
                {emailError && (
                  <p className="text-sm text-red-500">{emailError}</p>
                )}
                <p className="text-xs text-gray-500">Supports accented characters for French names</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone_number}
                  onChange={(e) => {
                    setProfileData({ ...profileData, phone_number: e.target.value });
                    setPhoneError('');
                  }}
                  onBlur={(e) => {
                    if (e.target.value) {
                      const validation = validatePhoneNumber(e.target.value);
                      if (!validation.isValid) {
                        setPhoneError(validation.error || '');
                      } else {
                        setProfileData(prev => ({
                          ...prev,
                          phone_number: formatPhoneNumber(e.target.value)
                        }));
                      }
                    }
                  }}
                  placeholder="514-123-4567 or +33 123 456 789"
                  className={phoneError ? 'border-red-500' : ''}
                />
                {phoneError && (
                  <p className="text-sm text-red-500">{phoneError}</p>
                )}
                <p className="text-xs text-gray-500">10 digits for Canada/France, or international with +</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stage">Current Stage</Label>
                <Select
                  value={profileData.stage}
                  onValueChange={(value) => {
                    setProfileData({ ...profileData, stage: value });
                    setStageError('');
                  }}
                >
                  <SelectTrigger className={stageError ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select your current stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_STAGES.map((stage) => (
                      <SelectItem key={stage.value} value={stage.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{stage.label}</span>
                          <span className="text-xs text-gray-500">{stage.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {stageError && (
                  <p className="text-sm text-red-500">{stageError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={profileData.bio}
                  onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  rows={4}
                />
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  placeholder="Enter new password"
                />
                <p className="text-xs text-gray-500">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  placeholder="Confirm new password"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={saving || !passwordData.newPassword || !passwordData.confirmPassword}
                variant="outline"
                className="w-full sm:w-auto"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                Irreversible actions that affect your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-400 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button variant="destructive" disabled>
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
