const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://sbnkwfsjixrngbgzupyd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNibmt3ZnNqaXhybmdiZ3p1cHlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxNzg0MjAsImV4cCI6MjA3Nzc1NDQyMH0.0YAGNGlx89wF4Zxnc4CYcksgI-XVW-BG2Xg5YbsI07I';

const supabase = createClient(supabaseUrl, supabaseKey);

async function uploadFile(filePath, storagePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    const contentType = getContentType(filePath);

    const { data, error } = await supabase.storage
      .from('websiteconfig')
      .upload(storagePath, fileBuffer, {
        contentType: contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error(`✗ Failed to upload ${fileName}:`, error.message);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('websiteconfig')
      .getPublicUrl(data.path);

    console.log(`✓ Uploaded: ${fileName} -> ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error(`✗ Error uploading ${filePath}:`, error.message);
    return null;
  }
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

async function main() {
  console.log('Starting upload of static files to websiteconfig bucket...\n');
  console.log('Supabase URL:', supabaseUrl);
  console.log('Bucket: websiteconfig\n');

  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(publicDir)) {
    console.error('Public directory not found!');
    process.exit(1);
  }

  const files = fs.readdirSync(publicDir);
  const imageFiles = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
  });

  console.log(`Found ${imageFiles.length} image files to upload\n`);

  const results = [];
  for (const file of imageFiles) {
    const filePath = path.join(publicDir, file);
    const storagePath = file;
    const url = await uploadFile(filePath, storagePath);
    results.push({ file, url, success: url !== null });
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`\n${'='.repeat(60)}`);
  console.log('Upload Summary:');
  console.log(`✓ Successfully uploaded: ${successful}/${imageFiles.length}`);
  if (failed > 0) {
    console.log(`✗ Failed: ${failed}`);
  }
  console.log(`${'='.repeat(60)}\n`);

  console.log('Files uploaded to: https://sbnkwfsjixrngbgzupyd.supabase.co/storage/v1/object/public/websiteconfig/\n');
}

main().catch(console.error);
