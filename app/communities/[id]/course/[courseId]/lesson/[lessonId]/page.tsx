"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { StorageVideo } from '@/components/storage-video';

interface Lesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  content: string | null;
  duration_minutes: number | null;
  order_index: number;
}

interface Course {
  id: string;
  community_id: string;
  title: string;
}

export default function LessonPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [allLessons, setAllLessons] = useState<Lesson[]>([]);
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(true);

  const lessonId = params.lessonId as string;
  const courseId = params.courseId as string;
  const communityId = params.id as string;

  useEffect(() => {
    if (!user) {
      router.push('/sign-in');
      return;
    }

    loadLessonData();
  }, [user, lessonId]);

  const loadLessonData = async () => {
    setLoading(true);

    const [lessonRes, courseRes, modulesRes, progressRes] = await Promise.all([
      supabase.from('community_lessons').select('*').eq('id', lessonId).single(),
      supabase.from('community_courses').select('id, community_id, title').eq('id', courseId).single(),
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
        .select('completed')
        .eq('user_id', user!.id)
        .eq('lesson_id', lessonId)
        .maybeSingle()
    ]);

    if (lessonRes.data) setLesson(lessonRes.data);
    if (courseRes.data) {
      // Security check: Ensure course belongs to the current community
      if (courseRes.data.community_id !== communityId) {
        console.error('Course does not belong to this community');
        router.push(`/communities/${communityId}`);
        return;
      }
      setCourse(courseRes.data);
    }

    if (modulesRes.data) {
      const allLessonsArray = modulesRes.data.flatMap((module: any) =>
        (module.lessons || []).sort((a: any, b: any) => a.order_index - b.order_index)
      );
      setAllLessons(allLessonsArray);
    }

    if (progressRes.data) setCompleted(progressRes.data.completed);

    setLoading(false);
  };

  const markAsCompleted = async () => {
    if (!user || !lesson || completed) return;

    try {
      const { error } = await supabase
        .from('user_lesson_progress')
        .upsert({
          user_id: user.id,
          lesson_id: lesson.id,
          completed: true,
          completed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,lesson_id'
        });

      if (!error) {
        setCompleted(true);
      }
    } catch (error) {
      console.error('Error marking lesson as completed:', error);
    }
  };

  const copyLessonLink = async () => {
    const { copyLinkToClipboard, getCopySuccessMessage } = await import('@/lib/copy-link');
    const { toast } = await import('sonner');

    const success = await copyLinkToClipboard({
      type: 'lesson',
      id: lessonId,
      communityId: communityId,
      courseId: courseId,
    });

    if (success) {
      toast.success('Link copied!', {
        description: getCopySuccessMessage('lesson'),
      });
    } else {
      toast.error('Failed to copy link');
    }
  };

  const goToNextLesson = () => {
    const currentIndex = allLessons.findIndex(l => l.id === lessonId);
    if (currentIndex < allLessons.length - 1) {
      const nextLesson = allLessons[currentIndex + 1];
      router.push(`/communities/${communityId}/course/${courseId}/lesson/${nextLesson.id}`);
    } else {
      router.push(`/communities/${communityId}/course/${courseId}`);
    }
  };

  if (loading || !lesson || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading lesson...</p>
        </div>
      </div>
    );
  }

  const currentIndex = allLessons.findIndex(l => l.id === lessonId);
  const hasNextLesson = currentIndex < allLessons.length - 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-stone-950 to-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/communities/${communityId}/course/${courseId}`)}
            className="text-gray-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-100 truncate">{lesson.title}</h1>
            <p className="text-sm text-gray-400 truncate">{course.title}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={copyLessonLink}
            className="text-gray-400 hover:text-amber-400"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Video Player */}
        {lesson.video_url && (
          <Card className="mb-6 bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <StorageVideo
                  url={lesson.video_url}
                  className="w-full h-full"
                  onEnded={markAsCompleted}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lesson Content */}
        <Card className="mb-6 bg-gray-900/60 border-gray-800">
          <CardContent className="p-6">
            <h2 className="text-2xl font-bold text-gray-100 mb-4">{lesson.title}</h2>
            {lesson.description && (
              <p className="text-gray-300 mb-4">{lesson.description}</p>
            )}
            {lesson.content && (
              <div className="prose prose-invert max-w-none">
                <p className="text-gray-400 whitespace-pre-wrap">{lesson.content}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="outline"
            onClick={() => router.push(`/communities/${communityId}/course/${courseId}`)}
            className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Course
          </Button>

          <div className="flex items-center gap-3">
            {!completed && (
              <Button
                onClick={markAsCompleted}
                variant="outline"
                className="bg-gray-800 text-amber-400 border-amber-500/30 hover:bg-gray-700"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark as Complete
              </Button>
            )}

            {completed && hasNextLesson && (
              <Button
                onClick={goToNextLesson}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
              >
                Next Lesson →
              </Button>
            )}

            {completed && !hasNextLesson && (
              <Button
                onClick={() => router.push(`/communities/${communityId}/course/${courseId}`)}
                className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-gray-900"
              >
                Complete Course
              </Button>
            )}
          </div>
        </div>

        {/* Lessons Tab at Bottom */}
        <Card className="mt-6 bg-gray-900/60 border-gray-800">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Lessons</h3>
            <div className="space-y-2">
              {allLessons.map((l, index) => (
                <button
                  key={l.id}
                  onClick={() => router.push(`/communities/${communityId}/course/${courseId}/lesson/${l.id}`)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    l.id === lessonId
                      ? 'bg-gray-800 border-2 border-amber-500'
                      : 'bg-gray-800/50 border-2 border-transparent hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      l.id === lessonId
                        ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {index + 1}
                    </div>
                    <span className={`flex-1 ${l.id === lessonId ? 'text-gray-100 font-semibold' : 'text-gray-400'}`}>
                      {l.title}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
