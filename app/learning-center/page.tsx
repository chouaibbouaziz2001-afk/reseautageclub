"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Search, Calendar, Bell, Heart, MoreVertical, ChevronRight, Home } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StorageImage } from '@/components/storage-image';
import { ProtectedRoute } from '@/components/protected-route';

interface Course {
  id: string;
  community_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  banner_url: string | null;
  order_index: number;
  created_at: string;
  community?: {
    name: string;
    avatar_url: string | null;
  };
  total_lessons?: number;
  completed_lessons?: number;
  progress_percentage?: number;
  is_favorite?: boolean;
}

function LearningCenterContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const loadCourses = async () => {
    try {
      setLoading(true);

      console.log('Learning Center: Loading courses for user', user!.id);

      // First, get communities where user is a member
      const { data: membershipData, error: membershipError } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('user_id', user!.id);

      console.log('Learning Center: Memberships', { data: membershipData, error: membershipError });

      if (membershipError) {
        console.error('Learning Center: Membership error', membershipError);
        throw membershipError;
      }

      if (!membershipData || membershipData.length === 0) {
        console.log('Learning Center: No memberships found');
        setCourses([]);
        setLoading(false);
        return;
      }

      const userCommunityIds = membershipData.map(m => m.community_id);
      console.log('Learning Center: User community IDs', userCommunityIds);

      // Get courses only from communities where user is a member
      const { data: coursesData, error: coursesError } = await supabase
        .from('community_courses')
        .select(`
          *,
          community:communities(
            name,
            avatar_url
          )
        `)
        .in('community_id', userCommunityIds)
        .order('order_index', { ascending: true });

      console.log('Learning Center: Courses query result', { data: coursesData, error: coursesError });

      if (coursesError) {
        console.error('Learning Center: Courses error', coursesError);
        throw coursesError;
      }

      if (!coursesData || coursesData.length === 0) {
        console.log('Learning Center: No courses found');
        setCourses([]);
        setLoading(false);
        return;
      }

      const courseIds = coursesData.map(c => c.id);

      // Get modules and lessons for these courses
      const { data: modulesData } = await supabase
        .from('community_modules')
        .select('id, course_id')
        .in('course_id', courseIds);

      const moduleIds = modulesData?.map(m => m.id) || [];

      const { data: lessonsData } = await supabase
        .from('community_lessons')
        .select('id, module_id')
        .in('module_id', moduleIds);

      // Map lessons to courses
      const moduleToCourse = new Map();
      modulesData?.forEach(m => moduleToCourse.set(m.id, m.course_id));

      const courseLessons = new Map();
      lessonsData?.forEach(lesson => {
        const courseId = moduleToCourse.get(lesson.module_id);
        if (courseId) {
          if (!courseLessons.has(courseId)) {
            courseLessons.set(courseId, []);
          }
          courseLessons.get(courseId).push(lesson.id);
        }
      });

      // Get user progress for ALL lessons in one query
      const allLessonIds = lessonsData?.map(l => l.id) || [];
      const { data: progressData } = await supabase
        .from('user_lesson_progress')
        .select('lesson_id, completed')
        .eq('user_id', user!.id)
        .eq('completed', true)
        .in('lesson_id', allLessonIds);

      // Get user favorites
      const { data: favoritesData } = await supabase
        .from('user_course_favorites')
        .select('course_id')
        .eq('user_id', user!.id);

      const favoriteIds = new Set(favoritesData?.map(f => f.course_id) || []);
      const completedLessonIds = new Set(progressData?.map(p => p.lesson_id) || []);

      // Calculate progress for each course
      const coursesWithProgress = coursesData.map(course => {
        const lessons = courseLessons.get(course.id) || [];
        const totalLessons = lessons.length;
        const completedLessons = lessons.filter((lessonId: string) => completedLessonIds.has(lessonId)).length;
        const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        return {
          ...course,
          total_lessons: totalLessons,
          completed_lessons: completedLessons,
          progress_percentage: progressPercentage,
          is_favorite: favoriteIds.has(course.id),
        };
      });

      console.log('Learning Center: Final courses with progress', coursesWithProgress);

      setCourses(coursesWithProgress);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (courseId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await supabase
          .from('user_course_favorites')
          .delete()
          .eq('user_id', user!.id)
          .eq('course_id', courseId);
      } else {
        await supabase
          .from('user_course_favorites')
          .insert({
            user_id: user!.id,
            course_id: courseId,
          });
      }

      loadCourses();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const filteredCourses = courses.filter(course => {
    if (!searchQuery) return true;
    return course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           course.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const coursesTab = filteredCourses;
  const inProgressTab = filteredCourses.filter(c => c.progress_percentage! > 0 && c.progress_percentage! < 100);
  const favoritesTab = filteredCourses.filter(c => c.is_favorite);

  const CourseCard = ({ course, index }: { course: Course; index: number }) => (
    <Card className="bg-gray-900/80 border-gray-800 hover:border-gray-700 transition-all group overflow-hidden">
      {course.banner_url && (
        <div className="relative h-40 w-full overflow-hidden">
          <StorageImage
            src={course.banner_url}
            alt={course.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent" />
        </div>
      )}
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Course Icon */}
          <div className="h-16 w-16 md:h-20 md:w-20 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg flex-shrink-0">
            {course.icon || '📚'}
          </div>

          {/* Course Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-white mb-1 line-clamp-1">
                  {index + 1} - {course.title}
                </h3>
                <p className="text-sm text-gray-400 line-clamp-2">
                  {course.description || 'No description available'}
                </p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(course.id, course.is_favorite || false);
                }}
                className="text-gray-400 hover:text-amber-400 transition-colors"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="mt-4 mb-3">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-600 transition-all duration-300"
                  style={{ width: `${course.progress_percentage || 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {course.progress_percentage || 0}% complete
              </p>
            </div>

            {/* Start Button */}
            <Button
              onClick={() => router.push(`/communities/${course.community_id}/course/${course.id}`)}
              className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 group-hover:border-amber-500/50 transition-all"
            >
              Start Course
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur-lg border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-white">
                <span className="text-xl">🎓</span>
              </div>
              <h1 className="text-xl font-bold text-white">Learning Center</h1>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/feed" className="text-gray-400 hover:text-amber-400 p-2">
                <Home className="h-5 w-5" />
              </Link>
              <button className="text-gray-400 hover:text-amber-400 p-2">
                <Search className="h-5 w-5" />
              </button>
              <button className="text-gray-400 hover:text-amber-400 p-2">
                <Calendar className="h-5 w-5" />
              </button>
              <button className="text-gray-400 hover:text-amber-400 p-2">
                <Bell className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full bg-gray-900 border-b border-gray-800 rounded-none h-auto p-0">
            <TabsTrigger
              value="courses"
              className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none py-3 px-6 text-base"
            >
              Courses
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none py-3 px-6 text-base"
            >
              In Progress
            </TabsTrigger>
            <TabsTrigger
              value="favorites"
              className="flex-1 data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none py-3 px-6 text-base"
            >
              Favorites
              {favoritesTab.length > 0 && (
                <Badge className="ml-2 bg-gradient-to-r from-amber-500 to-yellow-600 text-gray-900 font-bold">
                  {favoritesTab.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="courses" className="space-y-4 mt-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
                  <p className="text-gray-400 mt-4">Loading courses...</p>
                </div>
              ) : coursesTab.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <span className="text-5xl">📚</span>
                  </div>
                  <p className="text-gray-400 text-lg mb-2">No courses available</p>
                  <p className="text-sm text-gray-500">Join a community to access their courses</p>
                  <Link href="/communities" className="inline-block mt-4">
                    <Button className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-gray-900 font-semibold">
                      Browse Communities
                    </Button>
                  </Link>
                </div>
              ) : (
                coursesTab.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)
              )}
            </TabsContent>

            <TabsContent value="in-progress" className="space-y-4 mt-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
                  <p className="text-gray-400 mt-4">Loading courses...</p>
                </div>
              ) : inProgressTab.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400">No courses in progress</p>
                  <p className="text-sm text-gray-500 mt-2">Start a course to see it here</p>
                </div>
              ) : (
                inProgressTab.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)
              )}
            </TabsContent>

            <TabsContent value="favorites" className="space-y-4 mt-0">
              {loading ? (
                <div className="text-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent"></div>
                  <p className="text-gray-400 mt-4">Loading favorites...</p>
                </div>
              ) : favoritesTab.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No favorite courses yet</p>
                  <p className="text-sm text-gray-500 mt-2">Tap the menu icon on a course to add it to favorites</p>
                </div>
              ) : (
                favoritesTab.map((course, index) => <CourseCard key={course.id} course={course} index={index} />)
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

export default function LearningCenterPage() {
  return (
    <ProtectedRoute>
      <LearningCenterContent />
    </ProtectedRoute>
  );
}
