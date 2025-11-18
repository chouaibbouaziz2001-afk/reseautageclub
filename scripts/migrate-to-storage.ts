import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFileToWebsiteConfig(filePath: string, storagePath: string) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const file = new File([fileBuffer], path.basename(filePath), {
      type: getContentType(filePath),
    });

    const { data, error } = await supabase.storage
      .from('websiteconfig')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('websiteconfig')
      .getPublicUrl(data.path);

    console.log(`✓ Uploaded: ${storagePath} -> ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error(`✗ Failed to upload ${filePath}:`, error);
    return null;
  }
}

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

async function migrateStaticFiles() {
  console.log('Starting migration of static files to Supabase Storage...\n');

  const publicDir = path.join(process.cwd(), 'public');
  const files = fs.readdirSync(publicDir);

  const uploadPromises = files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
    })
    .map((file) => {
      const filePath = path.join(publicDir, file);
      const storagePath = file;
      return uploadFileToWebsiteConfig(filePath, storagePath);
    });

  const results = await Promise.all(uploadPromises);
  const successful = results.filter(Boolean).length;

  console.log(`\n✓ Migration complete: ${successful}/${uploadPromises.length} files uploaded`);
}

migrateStaticFiles().catch(console.error);
