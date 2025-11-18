"use client";

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, Video as VideoIcon, Plus, X as XIcon, Copy, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface Course {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
}

interface Post {
  id: string;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  audio_url: string | null;
  created_at: string;
  embedded_course_id: string | null;
  author?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  embedded_course?: Course;
}

interface StartHereChatProps {
  posts: Post[];
  isAdmin: boolean;
  courses: Course[];
  communityId: string;
  onSendMessage: (content: string, mediaFile: File | null, mediaType: string, embeddedCourseId: string | null) => Promise<void>;
  sending: boolean;
}

export default function StartHereChat({ posts, isAdmin, courses, communityId, onSendMessage, sending }: StartHereChatProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'audio'>('text');
  const [embeddedCourseId, setEmbeddedCourseId] = useState<string | null>(null);
  const [showCourseSelector, setShowCourseSelector] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [posts]);

  const copyMessage = async (post: Post) => {
    let textToCopy = '';

    if (post.content) {
      textToCopy += post.content;
    }

    if (post.embedded_course) {
      textToCopy += `\n\n📚 Course: ${post.embedded_course.title}`;
      if (post.embedded_course.description) {
        textToCopy += `\n${post.embedded_course.description}`;
      }
    }

    if (post.image_url) {
      textToCopy += `\n🖼️ Image: ${post.image_url}`;
    }

    if (post.video_url) {
      textToCopy += `\n🎥 Video: ${post.video_url}`;
    }

    if (post.audio_url) {
      textToCopy += `\n🎵 Audio: ${post.audio_url}`;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(post.id);
      toast({
        title: 'Copied!',
        description: 'Message copied to clipboard',
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy message',
        variant: 'destructive',
      });
    }
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !mediaFile && !embeddedCourseId) || sending) return;

    await onSendMessage(newMessage, mediaFile, mediaType, embeddedCourseId);
    setNewMessage('');
    setMediaFile(null);
    setMediaType('text');
    setEmbeddedCourseId(null);
    setShowCourseSelector(false);
  };

  const selectedCourse = courses.find(c => c.id === embeddedCourseId);

  return (
    <div className="flex flex-col h-full max-w-5xl mx-auto w-full px-2 md:px-4">
      {/* Admin Post Area */}
      {isAdmin && (
        <Card className="bg-gray-900/80 border-gray-800 mb-4 md:mb-6 backdrop-blur-sm">
          <CardContent className="p-3 md:p-6">
            <Textarea
              placeholder="Make an announcement..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !showCourseSelector) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={3}
              className="mb-3 md:mb-4 bg-gray-800/60 border-gray-700 text-gray-200 placeholder:text-gray-500 resize-none focus:border-amber-500 transition-colors rounded-lg text-sm md:text-base"
            />

            {/* Course Selector */}
            {showCourseSelector && (
              <div className="mb-4 p-4 bg-gray-800/60 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-200">Select Course to Embed</h3>
                  <Button
                    onClick={() => {
                      setShowCourseSelector(false);
                      setEmbeddedCourseId(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                  >
                    <XIcon className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {courses.length === 0 ? (
                    <p className="text-sm text-gray-400">No courses available</p>
                  ) : (
                    courses.map((course) => (
                      <button
                        key={course.id}
                        onClick={() => {
                          setEmbeddedCourseId(course.id);
                          setShowCourseSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          embeddedCourseId === course.id
                            ? 'bg-amber-500/20 border border-amber-500/50'
                            : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                        }`}
                      >
                        <span className="text-2xl">{course.icon || '📚'}</span>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-gray-100">{course.title}</p>
                          {course.description && (
                            <p className="text-xs text-gray-400 line-clamp-1">{course.description}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Selected Course Preview */}
            {selectedCourse && !showCourseSelector && (
              <div className="mb-4 p-3 bg-gray-800/60 border border-amber-500/30 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedCourse.icon || '📚'}</span>
                  <div>
                    <p className="font-medium text-gray-100 text-sm">{selectedCourse.title}</p>
                    <p className="text-xs text-gray-400">Course attached</p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setEmbeddedCourseId(null);
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Media Preview */}
            {mediaFile && (
              <div className="mb-4 relative">
                {mediaType === 'image' && (
                  <div className="relative w-full h-64">
                    <Image
                      src={URL.createObjectURL(mediaFile)}
                      alt="Preview"
                      fill
                      className="rounded-lg object-cover"
                    />
                  </div>
                )}
                {mediaType === 'video' && (
                  <video
                    src={URL.createObjectURL(mediaFile)}
                    controls
                    className="rounded-lg max-h-64 w-full"
                  />
                )}
                {mediaType === 'audio' && (
                  <audio src={URL.createObjectURL(mediaFile)} controls className="w-full" />
                )}
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaType('text');
                  }}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 md:gap-3 flex-wrap">
              <Button
                onClick={() => setShowCourseSelector(!showCourseSelector)}
                variant="outline"
                size="sm"
                className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-amber-400 text-xs md:text-sm"
              >
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Course</span>
              </Button>

              <label>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setMediaFile(file);
                      setMediaType('image');
                    }
                  }}
                />
                <Button variant="outline" size="sm" type="button" asChild className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-amber-400 text-xs md:text-sm">
                  <span>
                    <ImageIcon className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Photo</span>
                  </span>
                </Button>
              </label>

              <label>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setMediaFile(file);
                      setMediaType('video');
                    }
                  }}
                />
                <Button variant="outline" size="sm" type="button" asChild className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-amber-400 text-xs md:text-sm">
                  <span>
                    <VideoIcon className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">Video</span>
                  </span>
                </Button>
              </label>

              <Button
                onClick={handleSend}
                disabled={(!newMessage.trim() && !mediaFile && !embeddedCourseId) || sending}
                className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-gray-900 font-semibold shadow-lg px-4 md:px-8 text-xs md:text-sm"
              >
                <Send className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Post </span>Announcement
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages Feed */}
      <div className="space-y-3 md:space-y-6 pb-20">
        {posts.map((post) => (
          <Card key={post.id} className="bg-gray-900/80 border-gray-800 backdrop-blur-sm hover:border-gray-700 transition-colors group">
            <CardContent className="p-4 md:p-6">
              <div className="flex gap-3 md:gap-4">
                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-amber-500 flex-shrink-0">
                  <AvatarImage src={post.author?.avatar_url || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-amber-500 to-yellow-500 text-gray-900 font-bold text-sm md:text-base">
                    {post.author?.full_name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 md:mb-2 flex-wrap">
                    <span className="font-bold text-gray-100 text-base md:text-lg">{post.author?.full_name}</span>
                    <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-gray-900 text-xs px-2 py-0.5 font-semibold">
                      Admin
                    </Badge>
                  </div>

                  <p className="text-xs md:text-sm text-gray-400 mb-2 md:mb-3">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>

                  {post.content && (
                    <p className="text-gray-200 text-sm md:text-base whitespace-pre-wrap mb-3 md:mb-4 leading-relaxed">{post.content}</p>
                  )}

                  {post.image_url && (
                    <div className="relative w-full h-96">
                      <Image
                        src={post.image_url}
                        alt="Shared image"
                        fill
                        className="rounded-lg object-cover border border-gray-800 mb-3 md:mb-4"
                      />
                    </div>
                  )}

                  {post.video_url && (
                    <video
                      src={post.video_url}
                      controls
                      className="rounded-lg w-full border border-gray-800 mb-3 md:mb-4"
                    />
                  )}

                  {post.audio_url && (
                    <audio
                      src={post.audio_url}
                      controls
                      className="w-full mb-3 md:mb-4"
                    />
                  )}

                  {post.embedded_course && (
                    <Card className="mt-3 md:mt-4 bg-gradient-to-br from-gray-800 to-gray-900 border-amber-500/30 hover:border-amber-500 transition-all shadow-lg">
                      <CardContent className="p-4 md:p-5">
                        <div className="flex items-center gap-3 md:gap-4 mb-3 md:mb-4">
                          <div className="h-12 w-12 md:h-16 md:w-16 bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl flex items-center justify-center text-2xl md:text-3xl shadow-lg flex-shrink-0">
                            {post.embedded_course.icon || '📚'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-base md:text-lg text-gray-100">{post.embedded_course.title}</h4>
                            {post.embedded_course.description && (
                              <p className="text-xs md:text-sm text-gray-400 line-clamp-2 mt-1">{post.embedded_course.description}</p>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => router.push(`/communities/${communityId}/course/${post.embedded_course!.id}`)}
                          className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-gray-900 font-semibold shadow-md text-xs md:text-sm"
                        >
                          VIEW COURSE
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  <div className="mt-3 md:mt-4 flex items-center gap-2">
                    <Button
                      onClick={() => copyMessage(post)}
                      size="sm"
                      variant="ghost"
                      className="text-gray-400 hover:text-amber-400 hover:bg-gray-800/50 text-xs md:text-sm"
                    >
                      {copiedId === post.id ? (
                        <>
                          <Check className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 text-green-400" />
                          <span className="text-green-400">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!isAdmin && (
        <Card className="bg-gray-900/50 border-gray-800 mt-4">
          <CardContent className="py-4 text-center">
            <p className="text-gray-500 text-sm">Only admins can post in this channel</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
