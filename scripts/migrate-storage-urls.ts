import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface MigrationResult {
  table: string;
  column: string;
  updated: number;
  errors: number;
}

function convertUrlToStorageRef(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith('user-media:') || url.startsWith('websiteconfig:')) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (publicMatch) {
      const [, bucket, path] = publicMatch;
      if (bucket === 'user-media' || bucket === 'users-medias' || bucket === 'media') {
        return `user-media:${path}`;
      }
      if (bucket === 'websiteconfig') {
        return `websiteconfig:${path}`;
      }
    }

    const signMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+)\?/);
    if (signMatch) {
      const [, bucket, path] = signMatch;
      if (bucket === 'user-media' || bucket === 'users-medias' || bucket === 'media') {
        return `user-media:${path}`;
      }
      if (bucket === 'websiteconfig') {
        return `websiteconfig:${path}`;
      }
    }
  }

  return url;
}

async function migrateTable(
  tableName: string,
  columns: string[],
  idColumn: string = 'id'
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  for (const column of columns) {
    console.log(`\nMigrating ${tableName}.${column}...`);

    const { data: rows, error: fetchError } = await supabase
      .from(tableName)
      .select(`${idColumn}, ${column}`)
      .not(column, 'is', null);

    if (fetchError) {
      console.error(`Error fetching ${tableName}:`, fetchError);
      results.push({ table: tableName, column, updated: 0, errors: 1 });
      continue;
    }

    if (!rows || rows.length === 0) {
      console.log(`No rows to migrate in ${tableName}.${column}`);
      results.push({ table: tableName, column, updated: 0, errors: 0 });
      continue;
    }

    let updated = 0;
    let errors = 0;

    for (const row of rows) {
      const oldUrl = (row as any)[column];
      const newUrl = convertUrlToStorageRef(oldUrl);

      if (oldUrl !== newUrl && newUrl) {
        const { error: updateError } = await supabase
          .from(tableName)
          .update({ [column]: newUrl })
          .eq(idColumn, (row as any)[idColumn]);

        if (updateError) {
          console.error(`Error updating ${tableName}.${column} for ${idColumn}=${(row as any)[idColumn]}:`, updateError);
          errors++;
        } else {
          updated++;
          console.log(`✓ Updated ${tableName}.${column}: ${oldUrl} → ${newUrl}`);
        }
      }
    }

    console.log(`${tableName}.${column}: ${updated} updated, ${errors} errors`);
    results.push({ table: tableName, column, updated, errors });
  }

  return results;
}

async function runMigration() {
  console.log('Starting storage URL migration...\n');
  console.log('Converting all URLs to storage reference format:');
  console.log('- user-media:path for user uploads');
  console.log('- websiteconfig:path for static assets\n');

  const allResults: MigrationResult[] = [];

  allResults.push(...await migrateTable('profiles', ['avatar_url']));
  allResults.push(...await migrateTable('posts', ['image_url', 'video_url']));
  allResults.push(...await migrateTable('communities', ['avatar_url']));
  allResults.push(...await migrateTable('community_posts', ['image_url', 'video_url', 'audio_url']));
  allResults.push(...await migrateTable('community_chat_messages', ['media_url']));
  allResults.push(...await migrateTable('cofounder_messages', ['media_url']));
  allResults.push(...await migrateTable('admin_chat_messages', ['media_url']));
  allResults.push(...await migrateTable('events', ['cover_image_url']));
  allResults.push(...await migrateTable('user_rooms', ['avatar_url']));

  console.log('\n=== MIGRATION SUMMARY ===');
  console.log('Table'.padEnd(30), 'Column'.padEnd(20), 'Updated', 'Errors');
  console.log('-'.repeat(80));

  let totalUpdated = 0;
  let totalErrors = 0;

  for (const result of allResults) {
    console.log(
      result.table.padEnd(30),
      result.column.padEnd(20),
      result.updated.toString().padEnd(7),
      result.errors.toString()
    );
    totalUpdated += result.updated;
    totalErrors += result.errors;
  }

  console.log('-'.repeat(80));
  console.log(`Total: ${totalUpdated} updated, ${totalErrors} errors\n`);

  if (totalErrors === 0) {
    console.log('✅ Migration completed successfully!');
  } else {
    console.log(`⚠️  Migration completed with ${totalErrors} errors`);
  }
}

runMigration().catch(console.error);
