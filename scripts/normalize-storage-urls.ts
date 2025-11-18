import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

interface MigrationStats {
  table: string;
  totalRows: number;
  rowsWithMedia: number;
  urlsNormalized: number;
  alreadyNormalized: number;
  failed: number;
}

function extractPathFromUrl(url: string): string | null {
  const patterns = [
    /\/storage\/v1\/object\/public\/user-media\/(.+)$/,
    /\/storage\/v1\/object\/public\/media\/(.+)$/,
    /\/storage\/v1\/object\/sign\/user-media\/(.+)\?/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function normalizeMediaUrl(url: string | null): string | null {
  if (!url) return null;

  if (url.startsWith('user-media:') || url.startsWith('websiteconfig:')) {
    return url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (url.includes('/storage/v1/object/')) {
      const path = extractPathFromUrl(url);
      if (path) {
        return `user-media:${path}`;
      }
    }
    return url;
  }

  return url;
}

async function normalizeTable(
  tableName: string,
  idColumn: string,
  mediaColumns: string[]
): Promise<MigrationStats> {
  console.log(`\n📋 Processing table: ${tableName}`);
  console.log(`   Columns: ${mediaColumns.join(', ')}`);

  const stats: MigrationStats = {
    table: tableName,
    totalRows: 0,
    rowsWithMedia: 0,
    urlsNormalized: 0,
    alreadyNormalized: 0,
    failed: 0,
  };

  const { data: rows, error: fetchError } = await supabaseAdmin
    .from(tableName)
    .select(`${idColumn}, ${mediaColumns.join(', ')}`);

  if (fetchError) {
    console.error(`❌ Error fetching from ${tableName}:`, fetchError);
    return stats;
  }

  stats.totalRows = rows.length;

  for (const row of rows) {
    let hasMedia = false;
    const updates: Record<string, string | null> = {};

    for (const column of mediaColumns) {
      const value = row[column];
      if (!value) continue;

      hasMedia = true;
      const normalized = normalizeMediaUrl(value);

      if (normalized !== value) {
        updates[column] = normalized;
        stats.urlsNormalized++;
        console.log(`   ✏️  ${tableName}.${column} [${row[idColumn]}]`);
        console.log(`      FROM: ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
        console.log(`      TO:   ${normalized}`);
      } else if (value.startsWith('user-media:') || value.startsWith('websiteconfig:')) {
        stats.alreadyNormalized++;
      }
    }

    if (hasMedia) {
      stats.rowsWithMedia++;
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from(tableName)
        .update(updates)
        .eq(idColumn, row[idColumn]);

      if (updateError) {
        console.error(`   ❌ Failed to update ${tableName} row ${row[idColumn]}:`, updateError);
        stats.failed++;
      }
    }
  }

  return stats;
}

async function main() {
  console.log('🔄 Starting Media URL Normalization');
  console.log('━'.repeat(60));
  console.log('📌 Target: Convert all full URLs to storage references');
  console.log('📌 Format: user-media:<path>');
  console.log('📌 Scope: ALL tables EXCEPT profiles');
  console.log('━'.repeat(60));

  const tablesToNormalize: Array<{
    table: string;
    idColumn: string;
    ownerColumn: string;
    mediaColumns: string[];
  }> = [
    {
      table: 'posts',
      idColumn: 'id',
      ownerColumn: 'user_id',
      mediaColumns: ['image_url', 'video_url'],
    },
    {
      table: 'community_posts',
      idColumn: 'id',
      ownerColumn: 'user_id',
      mediaColumns: ['image_url', 'video_url', 'audio_url'],
    },
    {
      table: 'community_chat_messages',
      idColumn: 'id',
      ownerColumn: 'user_id',
      mediaColumns: ['media_url'],
    },
    {
      table: 'admin_chat_messages',
      idColumn: 'id',
      ownerColumn: 'sender_id',
      mediaColumns: ['media_url'],
    },
    {
      table: 'cofounder_messages',
      idColumn: 'id',
      ownerColumn: 'sender_id',
      mediaColumns: ['media_url'],
    },
    {
      table: 'messages',
      idColumn: 'id',
      ownerColumn: 'sender_id',
      mediaColumns: ['content'],
    },
    {
      table: 'events',
      idColumn: 'id',
      ownerColumn: 'organizer_id',
      mediaColumns: ['cover_image_url'],
    },
    {
      table: 'communities',
      idColumn: 'id',
      ownerColumn: 'created_by',
      mediaColumns: ['avatar_url'],
    },
    {
      table: 'user_rooms',
      idColumn: 'id',
      ownerColumn: 'user_id',
      mediaColumns: ['avatar_url'],
    },
  ];

  const allStats: MigrationStats[] = [];

  for (const config of tablesToNormalize) {
    const stats = await normalizeTable(
      config.table,
      config.idColumn,
      config.mediaColumns
    );
    allStats.push(stats);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 NORMALIZATION SUMMARY');
  console.log('='.repeat(60));

  let totalRows = 0;
  let totalWithMedia = 0;
  let totalNormalized = 0;
  let totalAlreadyNormalized = 0;
  let totalFailed = 0;

  for (const stats of allStats) {
    console.log(`\n📋 ${stats.table}`);
    console.log(`   Total rows:           ${stats.totalRows}`);
    console.log(`   Rows with media:      ${stats.rowsWithMedia}`);
    console.log(`   URLs normalized:      ${stats.urlsNormalized}`);
    console.log(`   Already normalized:   ${stats.alreadyNormalized}`);
    if (stats.failed > 0) {
      console.log(`   ❌ Failed:            ${stats.failed}`);
    }

    totalRows += stats.totalRows;
    totalWithMedia += stats.rowsWithMedia;
    totalNormalized += stats.urlsNormalized;
    totalAlreadyNormalized += stats.alreadyNormalized;
    totalFailed += stats.failed;
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 OVERALL TOTALS');
  console.log('='.repeat(60));
  console.log(`Total rows processed:    ${totalRows}`);
  console.log(`Rows with media:         ${totalWithMedia}`);
  console.log(`✅ URLs normalized:      ${totalNormalized}`);
  console.log(`✅ Already normalized:   ${totalAlreadyNormalized}`);
  console.log(`❌ Failed updates:       ${totalFailed}`);
  console.log('='.repeat(60));

  if (totalFailed > 0) {
    console.log('\n⚠️  WARNING: Some updates failed. Check logs above.');
    process.exit(1);
  }

  console.log('\n✅ SUCCESS: All media URLs normalized to storage references!');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
