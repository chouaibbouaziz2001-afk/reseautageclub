import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertStorageReference } from '@/lib/storage-helpers';
import { sanitizeText } from '@/lib/sanitize';
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from '@/lib/rate-limit';
import { requireEnv } from '@/lib/server-env-validation';

export const dynamic = 'force-dynamic';

// SECURITY: Validate environment variables at module load time
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function POST(request: NextRequest) {
  try {
    console.log('[API] POST /api/posts/create - Starting...', {
      timestamp: new Date().toISOString(),
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey,
    });

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[API] No authorization header');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[API] Auth verification failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimit = checkRateLimit(user.id, RATE_LIMITS.createPost);
    if (rateLimit.limited) {
      console.warn('[API] Rate limit exceeded', { userId: user.id });
      return createRateLimitResponse(rateLimit.resetTime);
    }

    const body = await request.json();
    let { content, image_url, video_url, media_type, shared_post_id } = body;
    
    // SECURITY: Validate shared_post_id is a valid UUID if provided
    if (shared_post_id) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(shared_post_id)) {
        return NextResponse.json(
          { error: 'Invalid shared_post_id format' },
          { status: 400 }
        );
      }
    }

    // Sanitize content
    if (content) {
      content = sanitizeText(content).substring(0, 5000);
    }

    // Validate content length
    if (!content && !image_url && !video_url && !shared_post_id) {
      return NextResponse.json(
        { error: 'Post must have content or media' },
        { status: 400 }
      );
    }

    // Validate storage references
    try {
      assertStorageReference(image_url);
      assertStorageReference(video_url);
    } catch (error) {
      console.error('[API] Storage reference validation failed:', error);
      return NextResponse.json(
        { error: 'Invalid media reference' },
        { status: 400 }
      );
    }

    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        content: content?.trim() || '',
        image_url,
        video_url,
        media_type,
        shared_post_id,
        likes_count: 0,
        comments_count: 0,
        share_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[API] Database insert error:', insertError.message);
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      );
    }

    console.log('[API] Post created successfully', { postId: post.id });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    console.error('[API] Unexpected error in create post route:', error);
    return NextResponse.json(
      { error: 'An error occurred' },
      { status: 500 }
    );
  }
}
