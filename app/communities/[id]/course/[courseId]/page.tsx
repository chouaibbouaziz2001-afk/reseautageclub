"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useDatabase } from '@/lib/db-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, CheckCircle2, Circle, Play, Plus, Settings, Pencil, Trash2, Upload, Video, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface Lesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  order_index: number;
  duration: number | null;
  completed?: boolean;
}

interface Module {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  order_index: number;
  lessons?: Lesson[];
}

interface Course {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  icon: string | null;
}

export default function CoursePage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const { profile } = useDatabase();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [newModule, setNewModule] = useState({ title: '', description: '' });
  const [newLesson, setNewLesson] = useState({ title: '', description: '', video_url: '' });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const videoInputRef = useRef<HTMLInputElement>(null);

  const courseId = params.courseId as string;
  const communityId = params.id as string;

  useEffect(() => {
    if (!user) {
      router.push('/sign-in');
      return;
    }

    loadCourseData();
    checkAdminStatus();
  }, [user, courseId]);

  const checkAdminStatus = async () => {
    const { data } = await supabase
      .from('community_members')
      .select('role')
      .eq('community_id', communityId)
      .eq('user_id', user!.id)
      .maybeSingle();

    setIsAdmin(data?.role === 'admin');
  };

  const loadCourseData = async () => {
    try {
      // Fetch everything in parallel for faster loading
      const [courseRes, modulesRes, progressRes] = await Promise.all([
        supabase.from('community_courses').select('*').eq('id', courseId).maybeSingle(),
        supabase
          .from('community_modules')
          .select(`
            *,
            lessons:community_lessons(*)
          `)
          .eq('course_id', courseId)
          .order('order_index', { ascending: true }),
        supabase
          .from('user_lesson_progress')
          .select('lesson_id, completed')
          .eq('user_id', user!.id)
      ]);

      if (courseRes.data) {
        // Security check: Ensure course belongs to the current community
        if (courseRes.data.community_id !== communityId) {
          console.error('Course does not belong to this community');
          toast.error('Course not found in this community');
          router.push(`/communities/${communityId}`);
          return;
        }
        setCourse(courseRes.data);
      }

      if (modulesRes.data) {
        const progressMap = new Map((progressRes.data || []).map(p => [p.lesson_id, p.completed]));

        const modulesWithProgress = modulesRes.data.map(module => ({
          ...module,
          lessons: (module.lessons || [])
            .sort((a: any, b: any) => a.order_index - b.order_index)
            .map((lesson: any) => ({
              ...lesson,
              completed: progressMap.get(lesson.id) || false
            }))
        }));

        setModules(modulesWithProgress);
      }
    } catch (error) {
      console.error('Error loading course data:', error);
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const createModule = async () => {
    if (!newModule.title.trim()) return;

    const { error } = await supabase.from('community_modules').insert({
      course_id: courseId,
      title: newModule.title,
      description: newModule.description || null,
      order_index: modules.length
    });

    if (!error) {
      setNewModule({ title: '', description: '' });
      setModuleDialogOpen(false);
      loadCourseData();
    }
  };

  const createLesson = async () => {
    if (!newLesson.title.trim() || !selectedModuleId) return;

    const selectedModule = modules.find(m => m.id === selectedModuleId);
    const lessonCount = selectedModule?.lessons?.length || 0;

    const { error } = await supabase.from('community_lessons').insert({
      module_id: selectedModuleId,
      title: newLesson.title,
      description: newLesson.description || null,
      video_url: newLesson.video_url || null,
      order_index: lessonCount
    });

    if (!error) {
      setNewLesson({ title: '', description: '', video_url: '' });
      setLessonDialogOpen(false);
      loadCourseData();
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast.error('Video file is too large. Maximum size is 50MB.');
      return;
    }

    setUploadingVideo(true);
    setUploadedFileName(file.name);
    toast.info('Uploading video... This may take a moment.');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user!.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('user-media')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('user-media')
        .getPublicUrl(fileName);

      setNewLesson(prev => ({ ...prev, video_url: publicUrl }));
      toast.success('Video uploaded successfully!');

      if (videoInputRef.current) {
        videoInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error('Failed to upload video. Please try again.');
      setUploadedFileName('');
    } finally {
      setUploadingVideo(false);
    }
  };

  const copyCourseLink = async () => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');

    const success = await copyLinkToClipboard({
      type: 'course',
      id: params.courseId as string,
      communityId: params.id as string,
    });

    if (success) {
      toast.success('Link copied!', {
        description: getCopySuccessMessage('course'),
      });
    } else {
      toast.error('Failed to copy link');
    }
  };

  const deleteModule = async (moduleId: string) => {
    if (!confirm('Delete this module? All lessons will be deleted.')) return;

    const { error } = await supabase.from('community_modules').delete().eq('id', moduleId);

    if (!error) {
      loadCourseData();
    }
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm('Delete this lesson?')) return;

    const { error } = await supabase.from('community_lessons').delete().eq('id', lessonId);

    if (!error) {
      loadCourseData();
    }
  };

  const allLessons = modules.flatMap(m => m.lessons || []);
  const completedCount = allLessons.filter(l => l.completed).length;
  const progressPercentage = allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  if (loading || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading course...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/communities/${communityId}`)}
            className="text-gray-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-gray-100 truncate flex-1">
            {course.title}
          </h1>
          <Button
            size="sm"
            variant="ghost"
            onClick={copyCourseLink}
            className="text-gray-400 hover:text-amber-400"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="bg-gray-800 text-amber-400 border-amber-500/30">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 text-gray-100 max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Manage Course</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh]">
                  <div className="space-y-4">
                    <Button onClick={() => setModuleDialogOpen(true)} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Module
                    </Button>

                    {modules.map((module, moduleIdx) => (
                      <Card key={module.id} className="bg-gray-800 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-100">Module {moduleIdx + 1}: {module.title}</h3>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteModule(module.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedModuleId(module.id);
                              setLessonDialogOpen(true);
                            }}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-100 mb-2"
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            Add Lesson
                          </Button>
                          {module.lessons && module.lessons.length > 0 && (
                            <div className="space-y-2 mt-2">
                              {module.lessons.map((lesson, lessonIdx) => (
                                <div key={lesson.id} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                                  <span className="text-sm text-gray-300">{lessonIdx + 1}. {lesson.title}</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => deleteLesson(lesson.id)}
                                    className="text-red-400 hover:text-red-300 h-6 w-6 p-0"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Course Header Card */}
        <Card className="mb-6 bg-gray-900/60 border-gray-800 border-2 border-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="h-16 w-16 bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg flex items-center justify-center text-3xl flex-shrink-0 border-2 border-gray-700">
                {course.icon || '📚'}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-100 mb-2">{course.title}</h2>
                {course.description && (
                  <p className="text-gray-400">{course.description}</p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-semibold">{progressPercentage}% complete</span>
                <span className="text-gray-500">
                  {modules.length} {modules.length === 1 ? 'Module' : 'Modules'} • {allLessons.length} Lessons
                </span>
              </div>
              <div className="w-full bg-gray-800 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 h-3 rounded-full transition-all"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modules and Lessons */}
        <div className="space-y-6">
          {modules.map((module, moduleIdx) => (
            <div key={module.id} className="space-y-3">
              <h3 className="text-xl font-semibold text-gray-300">
                Module {moduleIdx + 1} - {module.title}
              </h3>

              {module.lessons && module.lessons.map((lesson, lessonIdx) => (
                <Card
                  key={lesson.id}
                  className="bg-gray-900/60 border-gray-800 hover:border-amber-500/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/communities/${communityId}/course/${courseId}/lesson/${lesson.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {lesson.completed ? (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-gray-900" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-800 border-2 border-gray-700 flex items-center justify-center">
                            <Circle className="h-6 w-6 text-gray-600" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-100">{lesson.title}</h4>
                        {lesson.description && (
                          <p className="text-sm text-gray-400 mt-1 line-clamp-1">{lesson.description}</p>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="flex-shrink-0 text-amber-500 hover:text-amber-400 hover:bg-gray-800"
                      >
                        <Play className="h-5 w-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {(!module.lessons || module.lessons.length === 0) && (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="py-8">
                    <p className="text-center text-gray-400 text-sm">No lessons in this module yet</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ))}

          {modules.length === 0 && (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-12">
                <div className="text-center space-y-3">
                  <div className="text-5xl">📚</div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-100 mb-1">No modules yet</h3>
                    <p className="text-gray-400 text-sm">
                      {isAdmin ? 'Click Manage to add modules and lessons' : 'Check back later for course content'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Add Module Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-gray-100">
          <DialogHeader>
            <DialogTitle>Add Module</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Module Title</label>
              <Input
                value={newModule.title}
                onChange={(e) => setNewModule(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Campus Orientation"
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Description (optional)</label>
              <Textarea
                value={newModule.description}
                onChange={(e) => setNewModule(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this module covers"
                className="bg-gray-800 border-gray-700 text-gray-100"
                rows={3}
              />
            </div>
            <Button onClick={createModule} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900">
              Create Module
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Lesson Dialog */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-gray-100">
          <DialogHeader>
            <DialogTitle>Add Lesson</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Lesson Title</label>
              <Input
                value={newLesson.title}
                onChange={(e) => setNewLesson(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Welcome To The Campus"
                className="bg-gray-800 border-gray-700 text-gray-100"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Description (optional)</label>
              <Textarea
                value={newLesson.description}
                onChange={(e) => setNewLesson(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this lesson covers"
                className="bg-gray-800 border-gray-700 text-gray-100"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Video</label>
              {newLesson.video_url ? (
                <div className="space-y-2">
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3 flex items-center gap-2">
                    <Video className="h-5 w-5 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm text-green-400 font-medium">Video uploaded successfully</p>
                      {uploadedFileName && (
                        <p className="text-xs text-gray-400 truncate">{uploadedFileName}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNewLesson(prev => ({ ...prev, video_url: '' }));
                        setUploadedFileName('');
                      }}
                      className="text-red-400 hover:text-red-300 h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="cursor-pointer">
                    <div className="bg-gray-800 border-2 border-dashed border-gray-700 hover:border-amber-500/50 rounded-lg p-6 text-center transition-colors">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">
                        {uploadingVideo ? 'Uploading...' : 'Click to upload video'}
                      </p>
                    </div>
                    <input
                      ref={videoInputRef}
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                      disabled={uploadingVideo}
                    />
                  </label>
                  <p className="text-xs text-gray-500 mt-2">Or enter video URL:</p>
                  <Input
                    value={newLesson.video_url}
                    onChange={(e) => setNewLesson(prev => ({ ...prev, video_url: e.target.value }))}
                    placeholder="https://example.com/video.mp4"
                    className="bg-gray-800 border-gray-700 text-gray-100 mt-1"
                  />
                </div>
              )}
            </div>
            <Button
              onClick={createLesson}
              disabled={!newLesson.title.trim() || uploadingVideo}
              className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
            >
              Create Lesson
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
