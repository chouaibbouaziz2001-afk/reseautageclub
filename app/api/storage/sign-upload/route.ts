import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validatePath, generateSecureFilename, getExtensionFromContentType } from '@/lib/file-validation';
import { checkRateLimit, RATE_LIMITS, createRateLimitResponse } from '@/lib/rate-limit';
import { requireEnv } from '@/lib/server-env-validation';

export const dynamic = 'force-dynamic';

// SECURITY: Validate environment variables at module load time
const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Service key is required for this route but validated lazily to allow build without it
function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for file uploads. Please set it in your .env.local file.');
  }
  return key;
}

export async function POST(request: NextRequest) {
  try {
    const supabaseServiceKey = getServiceKey();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limiting
    const rateLimit = checkRateLimit(user.id, RATE_LIMITS.upload);
    if (rateLimit.limited) {
      console.warn('[API] Rate limit exceeded for upload', { userId: user.id });
      return createRateLimitResponse(rateLimit.resetTime);
    }

    const { bucket, contentType } = await request.json();

    if (!bucket || !contentType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate bucket
    const allowedBuckets = ['user-media', 'websiteconfig'];
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json({ error: 'Invalid bucket' }, { status: 400 });
    }

    // Generate secure filename
    const extension = getExtensionFromContentType(contentType);
    const secureFilename = generateSecureFilename(extension);

    // Build path with user ID
    const path = bucket === 'user-media' ? `${user.id}/${secureFilename}` : secureFilename;

    // Validate path
    const pathValidation = validatePath(path, user.id, bucket);
    if (!pathValidation.valid) {
      return NextResponse.json({ error: pathValidation.error }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error) {
      console.error('[API] Error creating signed upload URL:', {
        message: error.message,
        name: error.name,
      });
      return NextResponse.json({ error: 'Failed to create upload URL' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      objectPath: data.path,
      token: data.token,
      storageReference: `${bucket}:${data.path}`,
      contentType,
    });
  } catch (error) {
    console.error('[API] Unexpected error in sign-upload route:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}
