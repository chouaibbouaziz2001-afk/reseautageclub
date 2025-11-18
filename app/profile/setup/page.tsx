"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { uploadToUserMedia } from '@/lib/storage';
import { compressImage, getCompressionSettings } from '@/lib/compression';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, X, Camera, Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUSINESS_STAGES, validateEmail, validatePhoneNumber, validateStage, normalizePhoneNumber, formatPhoneNumber } from '@/lib/validation';

const SKILLS_SUGGESTIONS = [
  'Product Development',
  'Marketing',
  'Sales',
  'Engineering',
  'Design',
  'Business Development',
  'Finance',
  'Operations',
  'Legal',
  'HR',
];

const INTEREST_SUGGESTIONS = [
  'SaaS',
  'E-commerce',
  'FinTech',
  'HealthTech',
  'EdTech',
  'AI/ML',
  'Blockchain',
  'Mobile Apps',
  'Web3',
  'Social Impact',
];

const LOOKING_FOR_OPTIONS = [
  'Co-founder',
  'Mentor',
  'Investor',
  'Advisor',
  'Partner',
  'Team Member',
];

export default function ProfileSetup() {
  const { user, refreshUser } = useAuth();
  const { profile, refreshProfile } = useDatabase();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    stage: '',
    phone_number: '',
    skills: [] as string[],
    interests: [] as string[],
    looking_for: [] as string[],
    avatar_url: '',
  });

  const [customSkill, setCustomSkill] = useState('');
  const [customInterest, setCustomInterest] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [stageError, setStageError] = useState('');

  useEffect(() => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to set up your profile.",
        variant: "destructive",
      });
      setTimeout(() => router.replace('/sign-in'), 1000);
      return;
    }

    // If profile is already completed, redirect to feed
    if (profile?.profileCompleted) {
      console.log('[ProfileSetup] Profile already completed, redirecting to feed');
      toast({
        title: "Profile Complete",
        description: "Your profile is already set up. Taking you to the feed...",
      });
      setTimeout(() => router.replace('/feed'), 1000);
      return;
    }

    loadExistingProfile();
  }, [user, profile?.profileCompleted, router]);

  const loadExistingProfile = async () => {
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        stage: profile.stage || '',
        phone_number: profile.phone_number || '',
        skills: profile.skills || [],
        interests: profile.interests || [],
        looking_for: profile.looking_for || [],
        avatar_url: profile.avatar_url || '',
      });
    } else {
      setFormData(prev => ({
        ...prev,
        full_name: user.fullName || '',
      }));
    }
  };

  const toggleArrayItem = (array: string[], item: string) => {
    if (array.includes(item)) {
      return array.filter(i => i !== item);
    }
    return [...array, item];
  };

  const addCustomItem = (field: 'skills' | 'interests', value: string) => {
    if (value.trim() && !formData[field].includes(value.trim())) {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value.trim()],
      }));
    }
  };

  const removeItem = (field: 'skills' | 'interests' | 'looking_for', item: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(i => i !== item),
    }));
  };

  const handlePhotoUpload = async (file: File) => {
    if (!user) return;

    setUploadingPhoto(true);
    try {
      // Apply maximum compression
      const settings = getCompressionSettings(file.size);
      const compressedFile = await compressImage(file, settings);

      console.log(`Avatar compressed: ${(file.size / 1024).toFixed(0)}KB -> ${(compressedFile.size / 1024).toFixed(0)}KB`);

      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const result = await uploadToUserMedia(compressedFile, user.id, 'avatars', fileName, {
        compress: false, // Already compressed
      });

      setFormData(prev => ({ ...prev, avatar_url: result.url }));
      toast({
        title: "Success",
        description: "Photo uploaded and compressed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };


  const handleSubmit = async () => {
    if (!user) return;

    setEmailError('');
    setPhoneError('');
    setStageError('');

    if (!formData.full_name.trim()) {
      toast({
        title: "Error",
        description: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    const stageValidation = validateStage(formData.stage);
    if (!stageValidation.isValid) {
      setStageError(stageValidation.error || '');
      toast({
        title: "Error",
        description: stageValidation.error,
        variant: "destructive",
      });
      return;
    }

    if (user.email) {
      const emailValidation = validateEmail(user.email);
      if (!emailValidation.isValid) {
        setEmailError(emailValidation.error || '');
        toast({
          title: "Error",
          description: emailValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    if (formData.phone_number) {
      const phoneValidation = validatePhoneNumber(formData.phone_number);
      if (!phoneValidation.isValid) {
        setPhoneError(phoneValidation.error || '');
        toast({
          title: "Error",
          description: phoneValidation.error,
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      const normalizedPhone = formData.phone_number ? normalizePhoneNumber(formData.phone_number) : null;

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name,
          bio: formData.bio,
          stage: formData.stage,
          phone_number: normalizedPhone,
          skills: formData.skills,
          interests: formData.interests,
          looking_for: formData.looking_for,
          avatar_url: formData.avatar_url,
          profile_completed: true,
          email: user.email || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      // Refresh both auth user and database profile
      await Promise.all([
        refreshUser(),
        refreshProfile()
      ]);

      toast({
        title: "Welcome to ReseautageClub!",
        description: "Your profile is complete. Redirecting to feed...",
      });

      setTimeout(() => router.push('/feed'), 1500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const isStep1Valid = formData.full_name.trim() && formData.bio.trim();
  const isStep2Valid = formData.stage && formData.looking_for.length > 0;
  const isStep3Valid = formData.skills.length > 0 && formData.interests.length > 0;

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-br from-blue-50 to-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-yellow-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-3xl">R</span>
            </div>
            <CardTitle className="text-3xl">Complete Your Profile</CardTitle>
            <CardDescription>
              Let&apos;s set up your profile so you can start connecting with entrepreneurs
            </CardDescription>
            <div className="flex justify-center gap-2 mt-4">
              <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-amber-500' : 'bg-gray-200'}`} />
              <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-amber-500' : 'bg-gray-200'}`} />
              <div className={`h-2 w-16 rounded-full ${step >= 3 ? 'bg-amber-500' : 'bg-gray-200'}`} />
              <div className={`h-2 w-16 rounded-full ${step >= 4 ? 'bg-amber-500' : 'bg-gray-200'}`} />
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="full_name">Full Name *</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <Label htmlFor="bio">Bio *</Label>
                      <Textarea
                        id="bio"
                        value={formData.bio}
                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                        placeholder="Tell us about yourself and your entrepreneurial journey..."
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone_number">Phone Number (Optional)</Label>
                      <Input
                        id="phone_number"
                        value={formData.phone_number}
                        onChange={(e) => {
                          setFormData({ ...formData, phone_number: e.target.value });
                          setPhoneError('');
                        }}
                        onBlur={(e) => {
                          if (e.target.value) {
                            const validation = validatePhoneNumber(e.target.value);
                            if (!validation.isValid) {
                              setPhoneError(validation.error || '');
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                phone_number: formatPhoneNumber(e.target.value)
                              }));
                            }
                          }
                        }}
                        placeholder="+1 (555) 123-4567 or 514-123-4567"
                        className={phoneError ? 'border-red-500' : ''}
                      />
                      {phoneError && (
                        <p className="text-sm text-red-500 mt-1">{phoneError}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">10 digits for Canada/France, or international format with +</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!isStep1Valid}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Your Journey</h3>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="stage">Current Stage *</Label>
                      <Select
                        value={formData.stage}
                        onValueChange={(value) => {
                          setFormData({ ...formData, stage: value });
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
                        <p className="text-sm text-red-500 mt-1">{stageError}</p>
                      )}
                    </div>

                    <div>
                      <Label>Looking For *</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {LOOKING_FOR_OPTIONS.map((item) => (
                          <Button
                            key={item}
                            type="button"
                            variant={formData.looking_for.includes(item) ? 'default' : 'outline'}
                            onClick={() =>
                              setFormData({
                                ...formData,
                                looking_for: toggleArrayItem(formData.looking_for, item),
                              })
                            }
                            className="justify-start"
                          >
                            {item}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={!isStep2Valid}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Skills & Interests</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Your Skills *</Label>
                      <div className="flex flex-wrap gap-2 mt-2 mb-3">
                        {formData.skills.map((skill) => (
                          <Badge key={skill} variant="secondary" className="gap-1">
                            {skill}
                            <button
                              onClick={() => removeItem('skills', skill)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {SKILLS_SUGGESTIONS.filter(s => !formData.skills.includes(s)).map((skill) => (
                          <Button
                            key={skill}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addCustomItem('skills', skill)}
                          >
                            + {skill}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add custom skill"
                          value={customSkill}
                          onChange={(e) => setCustomSkill(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomItem('skills', customSkill);
                              setCustomSkill('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addCustomItem('skills', customSkill);
                            setCustomSkill('');
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label>Your Interests *</Label>
                      <div className="flex flex-wrap gap-2 mt-2 mb-3">
                        {formData.interests.map((interest) => (
                          <Badge key={interest} variant="outline" className="gap-1">
                            {interest}
                            <button
                              onClick={() => removeItem('interests', interest)}
                              className="ml-1 hover:text-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        {INTEREST_SUGGESTIONS.filter(i => !formData.interests.includes(i)).map((interest) => (
                          <Button
                            key={interest}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addCustomItem('interests', interest)}
                          >
                            + {interest}
                          </Button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Add custom interest"
                          value={customInterest}
                          onChange={(e) => setCustomInterest(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCustomItem('interests', customInterest);
                              setCustomInterest('');
                            }
                          }}
                        />
                        <Button
                          type="button"
                          onClick={() => {
                            addCustomItem('interests', customInterest);
                            setCustomInterest('');
                          }}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <Button onClick={() => setStep(4)} disabled={!isStep3Valid}>
                    Next
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Profile Photo (Optional)</h3>
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <div className="h-32 w-32 rounded-full border-4 border-gray-800 overflow-hidden bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center">
                        {formData.avatar_url ? (
                          <div className="relative h-full w-full">
                            <Image src={formData.avatar_url} alt="Profile" fill className="object-cover" />
                          </div>
                        ) : (
                          <span className="text-white font-bold text-4xl">
                            {getInitials(formData.full_name || 'U')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="w-full space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="photo-upload">Upload Photo</Label>
                        <Input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handlePhotoUpload(file);
                          }}
                          disabled={uploadingPhoto}
                        />
                      </div>
                      {uploadingPhoto && (
                        <div className="flex items-center justify-center py-4">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(3)}>
                    Back
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Completing Setup...
                      </>
                    ) : (
                      'Complete Setup'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
