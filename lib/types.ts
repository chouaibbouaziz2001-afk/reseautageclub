// Shared TypeScript types for the application
// All data comes from Supabase - no localStorage

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  images: string[];
  videoUrl?: string;
  mediaType?: 'image' | 'video' | null;
  likes: string[];
  comments: Comment[];
  createdAt: string;
  sharedPostId?: string;
  sharedPost?: Post;
  shareCount: number;
  taggedUsers?: string[];
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: string;
}
