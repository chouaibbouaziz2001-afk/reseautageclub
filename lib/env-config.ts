interface NextDataPageProps {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export const getEnvConfig = () => {
  const isBrowser = typeof window !== 'undefined';

  // Try multiple sources for environment variables
  // Use type assertion to access Next.js data safely
  const nextData = isBrowser 
    ? (window as { __NEXT_DATA__?: { props?: { pageProps?: NextDataPageProps } } }).__NEXT_DATA__
    : undefined;

  let supabaseUrl = isBrowser
    ? nextData?.props?.pageProps?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL
    : process.env.NEXT_PUBLIC_SUPABASE_URL;

  let supabaseAnonKey = isBrowser
    ? nextData?.props?.pageProps?.supabaseAnonKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Use environment variables
  const url = supabaseUrl;
  const key = supabaseAnonKey;

  if (isBrowser) {
    console.log('Environment check:', {
      url: url ? 'SET' : 'MISSING',
      urlValue: url,
      key: key ? 'SET (length: ' + key.length + ')' : 'MISSING',
      keyPreview: key ? key.substring(0, 30) + '...' : 'MISSING',
      source: supabaseUrl ? 'env var' : 'fallback',
      processEnv: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'exists' : 'missing',
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'exists' : 'missing',
      }
    });
  }

  return {
    supabaseUrl: url,
    supabaseAnonKey: key,
  };
};
