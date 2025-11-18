import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface VerificationResult {
  totalPosts: number;
  postsWithMedia: number;
  storageReferencePosts: number;
  base64Posts: number;
  blobPosts: number;
  externalUrlPosts: number;
  invalidPosts: number;
  filesVerified: number;
  filesFailed: number;
}

async function verifyStorageMigration(): Promise<VerificationResult> {
  console.log('🔍 Starting storage migration verification...\n');

  const result: VerificationResult = {
    totalPosts: 0,
    postsWithMedia: 0,
    storageReferencePosts: 0,
    base64Posts: 0,
    blobPosts: 0,
    externalUrlPosts: 0,
    invalidPosts: 0,
    filesVerified: 0,
    filesFailed: 0,
  };

  const { data: posts, error } = await supabaseAdmin
    .from('posts')
    .select('id, image_url, video_url, media_type, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching posts:', error);
    process.exit(1);
  }

  result.totalPosts = posts.length;
  console.log(`📊 Total posts: ${result.totalPosts}`);

  for (const post of posts) {
    const mediaUrls = [post.image_url, post.video_url].filter(Boolean);

    if (mediaUrls.length === 0) continue;

    result.postsWithMedia++;

    for (const url of mediaUrls) {
      if (!url) continue;

      if (url.startsWith('data:')) {
        result.base64Posts++;
        console.log(`⚠️  Post ${post.id} contains base64 data`);
      } else if (url.startsWith('blob:')) {
        result.blobPosts++;
        console.log(`⚠️  Post ${post.id} contains blob URL`);
      } else if (url.startsWith('user-media:')) {
        result.storageReferencePosts++;

        const path = url.replace('user-media:', '');
        try {
          const { data: signedUrl, error: signError } = await supabaseAdmin.storage
            .from('user-media')
            .createSignedUrl(path, 60);

          if (signError) {
            console.log(`❌ Failed to verify ${path}: ${signError.message}`);
            result.filesFailed++;
          } else {
            const response = await fetch(signedUrl.signedUrl, { method: 'HEAD' });
            if (response.ok) {
              result.filesVerified++;
            } else {
              console.log(`❌ File not accessible: ${path} (HTTP ${response.status})`);
              result.filesFailed++;
            }
          }
        } catch (err) {
          console.log(`❌ Error verifying ${path}:`, err);
          result.filesFailed++;
        }
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        result.externalUrlPosts++;
      } else {
        result.invalidPosts++;
        console.log(`⚠️  Post ${post.id} has invalid media format: ${url.substring(0, 50)}`);
      }
    }
  }

  return result;
}

async function main() {
  const result = await verifyStorageMigration();

  console.log('\n' + '='.repeat(60));
  console.log('📈 VERIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total posts:                ${result.totalPosts}`);
  console.log(`Posts with media:           ${result.postsWithMedia}`);
  console.log(`✅ Storage references:      ${result.storageReferencePosts}`);
  console.log(`❌ Base64 posts:            ${result.base64Posts}`);
  console.log(`❌ Blob posts:              ${result.blobPosts}`);
  console.log(`🌐 External URLs:           ${result.externalUrlPosts}`);
  console.log(`⚠️  Invalid format:         ${result.invalidPosts}`);
  console.log(`\n📁 File Verification:`);
  console.log(`✅ Files verified:          ${result.filesVerified}`);
  console.log(`❌ Files failed:            ${result.filesFailed}`);
  console.log('='.repeat(60));

  if (result.base64Posts > 0 || result.blobPosts > 0 || result.invalidPosts > 0) {
    console.log('\n⚠️  WARNING: Some posts contain non-storage media!');
    console.log('Migration may be required.');
    process.exit(1);
  }

  if (result.filesFailed > 0) {
    console.log('\n⚠️  WARNING: Some storage files are not accessible!');
    console.log('Check the logs above for details.');
    process.exit(1);
  }

  console.log('\n✅ SUCCESS: All posts use proper storage references!');
  console.log('✅ All files are accessible in Supabase Storage.');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
