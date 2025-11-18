import { createClient } from '@supabase/supabase-js';
import { getEnvConfig } from './env-config';

const { supabaseUrl, supabaseAnonKey } = getEnvConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Missing Supabase credentials');
  }
  throw new Error('Missing Supabase credentials. Please check your environment variables.');
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'reseautageclub-auth',
      flowType: 'pkce',
    },
    global: {
      headers: {
        'X-Client-Info': 'reseautageclub-web',
        'apikey': supabaseAnonKey,
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);
