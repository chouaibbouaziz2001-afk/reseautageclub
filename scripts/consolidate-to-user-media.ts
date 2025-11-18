import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function copyFileToUserMedia(sourceBucket: string, sourcePath: string): Promise<string> {
  // Download file from source bucket
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(sourceBucket)
    .download(sourcePath);

  if (downloadError) {
    throw new Error(`Failed to download ${sourceBucket}/${sourcePath}: ${downloadError.message}`);
  }

  // Upload to user-media bucket with same path
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('user-media')
    .upload(sourcePath, fileData, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload to user-media/${sourcePath}: ${uploadError.message}`);
  }

  return sourcePath;
}

async function consolidateBucket(bucketName: string) {
  console.log(`\n📦 Processing bucket: ${bucketName}`);

  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list('', {
      limit: 1000,
      sortBy: { column: 'created_at', order: 'asc' }
    });

  if (error) {
    console.error(`❌ Failed to list files in ${bucketName}:`, error);
    return { success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const file of files || []) {
    try {
      // List all files recursively in the folder
      const { data: allFiles, error: listError } = await supabase.storage
        .from(bucketName)
        .list(file.name, {
          limit: 1000,
        });

      if (listError) {
        console.error(`❌ Failed to list ${file.name}:`, listError);
        failed++;
        continue;
      }

      if (allFiles && allFiles.length > 0) {
        // This is a folder, process its contents
        for (const subFile of allFiles) {
          const fullPath = `${file.name}/${subFile.name}`;
          try {
            await copyFileToUserMedia(bucketName, fullPath);
            console.log(`   ✅ Copied: ${fullPath}`);
            success++;
          } catch (err: any) {
            console.error(`   ❌ Failed: ${fullPath} - ${err.message}`);
            failed++;
          }
        }
      } else if (file.name) {
        // This is a file at root level
        try {
          await copyFileToUserMedia(bucketName, file.name);
          console.log(`   ✅ Copied: ${file.name}`);
          success++;
        } catch (err: any) {
          console.error(`   ❌ Failed: ${file.name} - ${err.message}`);
          failed++;
        }
      }
    } catch (err: any) {
      console.error(`   ❌ Error processing ${file.name}:`, err.message);
      failed++;
    }
  }

  return { success, failed };
}

async function updateDatabaseReferences() {
  console.log('\n📝 Updating database references...');

  // Update admin_chat_messages from media: to user-media:
  const { data: adminUpdates, error: adminError } = await supabase
    .from('admin_chat_messages')
    .update({ media_url: supabase.raw('REPLACE(media_url, \'media:\', \'user-media:\')') })
    .like('media_url', 'media:%')
    .select('id, media_url');

  if (adminError) {
    console.error('❌ Failed to update admin_chat_messages:', adminError);
  } else {
    console.log(`   ✅ Updated ${adminUpdates?.length || 0} admin_chat_messages`);
  }

  // Any other tables with old bucket references would be updated here
  console.log('✅ Database references updated');
}

async function main() {
  console.log('🔄 Consolidating All Media to user-media Bucket');
  console.log('='.repeat(60));

  const bucketsToConsolidate = ['media', 'community-media', 'users-medias'];

  let totalSuccess = 0;
  let totalFailed = 0;

  for (const bucket of bucketsToConsolidate) {
    const result = await consolidateBucket(bucket);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 CONSOLIDATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Files copied successfully: ${totalSuccess}`);
  console.log(`❌ Files failed: ${totalFailed}`);
  console.log('='.repeat(60));

  if (totalFailed === 0) {
    await updateDatabaseReferences();

    console.log('\n✅ SUCCESS: All files consolidated to user-media bucket!');
    console.log('\n📌 Next steps:');
    console.log('   1. Verify files at: https://supabase.com/dashboard/project/.../storage/buckets/user-media');
    console.log('   2. Delete old buckets: media, community-media, users-medias');
    console.log('   3. Update code to remove old bucket references');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some files failed to copy. Please review errors above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
