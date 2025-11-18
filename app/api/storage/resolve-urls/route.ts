import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for resolving storage URLs. Please set it in your .env.local file.');
  }
  return key;
}

interface ResolveRequest {
  references: string[];
  expiresIn?: number;
}

interface ResolveResponse {
  urls: Record<string, string>;
  errors: Record<string, string>;
}

function parseStorageReference(reference: string): { bucket: string; path: string } | null {
  if (!reference) return null;

  if (reference.startsWith('user-media:')) {
    return {
      bucket: 'user-media',
      path: reference.replace('user-media:', ''),
    };
  }

  if (reference.startsWith('websiteconfig:')) {
    return {
      bucket: 'websiteconfig',
      path: reference.replace('websiteconfig:', ''),
    };
  }

  const patterns = [
    /\/storage\/v1\/object\/public\/user-media\/(.+)$/,
    /\/storage\/v1\/object\/public\/users-medias\/(.+)$/,
    /\/storage\/v1\/object\/sign\/user-media\/(.+)\?/,
  ];

  for (const pattern of patterns) {
    const match = reference.match(pattern);
    if (match) {
      return {
        bucket: 'user-media',
        path: match[1],
      };
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authentication
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
    const rateLimit = checkRateLimit(user.id, RATE_LIMITS.api);
    if (rateLimit.limited) {
      console.warn('[API] Rate limit exceeded for resolve-urls', { userId: user.id });
      return createRateLimitResponse(rateLimit.resetTime);
    }

    const supabaseServiceKey = getServiceKey();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: ResolveRequest = await request.json();
    const { references, expiresIn = 3600 } = body;
    
    // SECURITY: Validate input
    if (!Array.isArray(references)) {
      return NextResponse.json({ error: 'Invalid request: references must be an array' }, { status: 400 });
    }

    // SECURITY: Limit array size to prevent abuse
    if (references.length > 100) {
      return NextResponse.json({ 
        error: 'Too many references. Maximum 100 references per request.' 
      }, { status: 400 });
    }
    
    // SECURITY: Validate expiresIn to prevent abuse
    const validExpiresIn = Math.min(Math.max(expiresIn || 3600, 60), 86400); // Between 1 minute and 24 hours

    const result: ResolveResponse = {
      urls: {},
      errors: {},
    };

    for (const reference of references) {
      if (!reference) {
        result.urls[reference] = '';
        continue;
      }

      if (reference.startsWith('http://') || reference.startsWith('https://')) {
        result.urls[reference] = reference;
        continue;
      }

      const parsed = parseStorageReference(reference);
      if (!parsed) {
        result.urls[reference] = reference;
        continue;
      }

      try {
        if (parsed.bucket === 'websiteconfig') {
          const { data } = supabaseAdmin.storage.from(parsed.bucket).getPublicUrl(parsed.path);
          result.urls[reference] = data.publicUrl;
        } else if (parsed.bucket === 'user-media') {
          // SECURITY: Validate path belongs to authenticated user
          if (!parsed.path.startsWith(`${user.id}/`)) {
            result.errors[reference] = 'Access denied: path must belong to authenticated user';
            result.urls[reference] = '';
            continue;
          }
          
          const { data, error } = await supabaseAdmin.storage
            .from('user-media')
            .createSignedUrl(parsed.path, validExpiresIn);

          if (error) {
            result.errors[reference] = error.message;
            result.urls[reference] = '';
          } else {
            result.urls[reference] = data.signedUrl;
          }
        }
      } catch (error) {
        result.errors[reference] = error instanceof Error ? error.message : 'Unknown error';
        result.urls[reference] = '';
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in resolve-urls route:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
