import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/server-env-validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

// Service key is required for admin routes but validated lazily to allow build without it
function getServiceKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Please set it in your .env.local file.');
  }
  return key;
}

interface TableStats {
  table: string;
  totalRows: number;
  rowsWithMedia: number;
  storageReferences: number;
  httpUrls: number;
  base64Data: number;
  filesVerified: number;
  filesFailed: number;
  errors: string[];
}

async function verifyTable(
  supabase: ReturnType<typeof createClient>,
  tableName: string,
  mediaColumns: string[]
): Promise<TableStats> {
  const stats: TableStats = {
    table: tableName,
    totalRows: 0,
    rowsWithMedia: 0,
    storageReferences: 0,
    httpUrls: 0,
    base64Data: 0,
    filesVerified: 0,
    filesFailed: 0,
    errors: [],
  };

  try {
    const { data: rows, error } = await supabase
      .from(tableName)
      .select(`id, ${mediaColumns.join(', ')}`)
      .limit(100);

    if (error) {
      stats.errors.push(`Failed to fetch: ${error.message}`);
      return stats;
    }

    stats.totalRows = rows.length;

    for (const row of rows) {
      let hasMedia = false;

      for (const column of mediaColumns) {
        const value = row[column] as string | null | undefined;
        if (!value || typeof value !== 'string') continue;

        hasMedia = true;

        if (value.startsWith('data:')) {
          stats.base64Data++;
        } else if (value.startsWith('user-media:') || value.startsWith('media:') || value.startsWith('websiteconfig:')) {
          stats.storageReferences++;

          const parts = value.split(':');
          if (parts.length === 2) {
            const [bucket, path] = parts;

            try {
              if (bucket === 'user-media') {
                const { data, error } = await supabase.storage
                  .from('user-media')
                  .createSignedUrl(path, 60);

                if (error) {
                  stats.filesFailed++;
                  stats.errors.push(`${tableName}.${column}: ${path} - ${error.message}`);
                } else {
                  const response = await fetch(data.signedUrl, { method: 'HEAD' });
                  if (response.ok) {
                    stats.filesVerified++;
                  } else {
                    stats.filesFailed++;
                    stats.errors.push(`${tableName}.${column}: ${path} - HTTP ${response.status}`);
                  }
                }
              } else {
                const { data } = supabase.storage.from(bucket).getPublicUrl(path);
                const response = await fetch(data.publicUrl, { method: 'HEAD' });
                if (response.ok) {
                  stats.filesVerified++;
                } else {
                  stats.filesFailed++;
                  stats.errors.push(`${tableName}.${column}: ${path} - HTTP ${response.status}`);
                }
              }
            } catch (err) {
              stats.filesFailed++;
              stats.errors.push(`${tableName}.${column}: ${path} - ${err instanceof Error ? err.message : 'Unknown error'}`);
            }
          }
        } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
          stats.httpUrls++;
        }
      }

      if (hasMedia) {
        stats.rowsWithMedia++;
      }
    }
  } catch (err) {
    stats.errors.push(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  return stats;
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Require authentication for admin routes
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

    // SECURITY: Check if user is admin via event_admins table
    // This route is for system admin operations, so we check for super admin
    const { data: adminCheck, error: adminError } = await supabaseClient
      .from('event_admins')
      .select('is_super_admin')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (adminError || !adminCheck || !adminCheck.is_super_admin) {
      return NextResponse.json({ 
        error: 'Access denied: Super admin privileges required' 
      }, { status: 403 });
    }
    
    const supabaseServiceKey = getServiceKey();
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const tablesToVerify = [
      { table: 'posts', columns: ['image_url', 'video_url'] },
      { table: 'community_posts', columns: ['image_url', 'video_url', 'audio_url'] },
      { table: 'community_chat_messages', columns: ['media_url'] },
      { table: 'admin_chat_messages', columns: ['media_url'] },
      { table: 'cofounder_messages', columns: ['media_url'] },
      { table: 'events', columns: ['cover_image_url'] },
      { table: 'communities', columns: ['avatar_url'] },
      { table: 'user_rooms', columns: ['avatar_url'] },
    ];

    const results: TableStats[] = [];

    for (const config of tablesToVerify) {
      const stats = await verifyTable(supabaseAdmin as any, config.table, config.columns);
      results.push(stats);
    }

    const summary = {
      totalTables: results.length,
      totalRows: results.reduce((sum, s) => sum + s.totalRows, 0),
      totalWithMedia: results.reduce((sum, s) => sum + s.rowsWithMedia, 0),
      totalStorageRefs: results.reduce((sum, s) => sum + s.storageReferences, 0),
      totalHttpUrls: results.reduce((sum, s) => sum + s.httpUrls, 0),
      totalBase64: results.reduce((sum, s) => sum + s.base64Data, 0),
      totalVerified: results.reduce((sum, s) => sum + s.filesVerified, 0),
      totalFailed: results.reduce((sum, s) => sum + s.filesFailed, 0),
      profilesExcluded: true,
    };

    const allErrors = results.flatMap(r => r.errors);

    return NextResponse.json({
      summary,
      tables: results,
      errors: allErrors,
      success: summary.totalBase64 === 0 && summary.totalFailed === 0,
    });
  } catch (error) {
    console.error('Error in verify-storage route:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 });
  }
}
