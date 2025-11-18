import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backfillMentions() {
  console.log('Starting comment mentions backfill...');
  
  try {
    const { data, error } = await supabase.rpc('backfill_comment_mentions');
    
    if (error) {
      console.error('Error running backfill:', error);
      process.exit(1);
    }
    
    console.log('\n✅ Backfill completed successfully!');
    console.log(`   Comments processed: ${data[0].comments_processed}`);
    console.log(`   Mentions added: ${data[0].mentions_added}`);
    
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

backfillMentions();
