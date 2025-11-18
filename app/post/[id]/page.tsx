'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { PostCard } from '@/components/post-card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';
import Link from 'next/link';
import type { Post } from '@/lib/types';
import { sanitizeUuid } from '@/lib/sanitize';

export default function PostPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (params?.id) {
      // Validate UUID format
      const validatedId = sanitizeUuid(params.id as string);
      if (!validatedId) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      loadPost(validatedId);
    }
  }, [params?.id, user]);

  const loadPost = async (postId: string) => {
    setLoading(true);
    setNotFound(false);

    try {
      // Try community_posts first
      let { data: postData, error: postError } = await supabase
        .from('community_posts')
        .select(`
          *,
          author:profiles!community_posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('id', postId)
        .maybeSingle();

      // If not found in community_posts, try posts table
      if (!postData) {
        const result = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
          `)
          .eq('id', postId)
          .maybeSingle();

        postData = result.data;
        postError = result.error;
      }

      if (postError) throw postError;

      if (!postData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: likesData } = await supabase
        .from('post_likes')
        .select('user_id')
        .eq('post_id', postId);

      const likes = likesData?.map(like => like.user_id) || [];

      const { data: tagData } = await supabase
        .from('post_tags')
        .select('tagged_user_id')
        .eq('post_id', postId);

      const taggedUsers = tagData?.map(tag => tag.tagged_user_id) || [];

      const transformedPost: Post = {
        id: postData.id,
        authorId: postData.author_id,
        authorName: postData.author.full_name,
        authorPhoto: postData.author.avatar_url,
        content: postData.content || '',
        images: postData.image_url ? [postData.image_url] : [],
        videoUrl: postData.video_url,
        mediaType: postData.video_url ? 'video' : (postData.image_url ? 'image' : null),
        likes: likes,
        comments: [],
        createdAt: postData.created_at,
        shareCount: postData.share_count || 0,
        taggedUsers: taggedUsers,
        sharedPostId: postData.shared_post_id,
      };

      if (postData.shared_post_id) {
        const { data: sharedPostData } = await supabase
          .from('posts')
          .select(`
            *,
            author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
          `)
          .eq('id', postData.shared_post_id)
          .maybeSingle();

        if (sharedPostData) {
          const { data: sharedTagData } = await supabase
            .from('post_tags')
            .select('tagged_user_id')
            .eq('post_id', sharedPostData.id);

          const sharedTaggedUsers = sharedTagData?.map(tag => tag.tagged_user_id) || [];

          transformedPost.sharedPost = {
            id: sharedPostData.id,
            authorId: sharedPostData.author_id,
            authorName: sharedPostData.author.full_name,
            authorPhoto: sharedPostData.author.avatar_url,
            content: sharedPostData.content || '',
            images: sharedPostData.image_url ? [sharedPostData.image_url] : [],
            videoUrl: sharedPostData.video_url,
            mediaType: sharedPostData.video_url ? 'video' : (sharedPostData.image_url ? 'image' : null),
            likes: [],
            comments: [],
            createdAt: sharedPostData.created_at,
            shareCount: 0,
            taggedUsers: sharedTaggedUsers,
          };
        }
      }

      setPost(transformedPost);
    } catch (error) {
      console.error('Error loading post:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-100 mb-4">Post Not Found</h1>
          <p className="text-gray-400 mb-6">The post you're looking for doesn't exist or has been removed.</p>
          <Link href="/feed">
            <Button className="bg-amber-500 hover:bg-amber-600 text-gray-900">
              <Home className="mr-2 h-4 w-4" />
              Go to Feed
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-gray-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Link href="/feed">
            <Button variant="ghost" className="text-gray-400 hover:text-gray-100">
              <Home className="mr-2 h-4 w-4" />
              Feed
            </Button>
          </Link>
        </div>

        <PostCard
          post={post}
          onUpdate={() => loadPost(params.id as string)}
        />
      </div>
    </div>
  );
}
