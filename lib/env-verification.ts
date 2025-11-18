/**
 * Environment Verification Utility
 * Verifies all required environment variables are present and valid
 */

export interface EnvCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    supabaseUrl: string;
    hasAnonKey: boolean;
    anonKeyLength: number;
    environment: 'development' | 'production' | 'unknown';
    isBrowser: boolean;
  };
}

export function verifyEnvironment(): EnvCheckResult {
  const isBrowser = typeof window !== 'undefined';
  const errors: string[] = [];
  const warnings: string[] = [];

  // Get environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Check Supabase URL
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is missing');
  } else if (!supabaseUrl.startsWith('https://')) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL should use HTTPS');
  } else if (!supabaseUrl.includes('supabase.co')) {
    warnings.push('NEXT_PUBLIC_SUPABASE_URL does not appear to be a Supabase URL');
  }

  // Check Anon Key
  if (!supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is missing');
  } else if (supabaseAnonKey.length < 100) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY appears to be invalid (too short)');
  } else if (!supabaseAnonKey.startsWith('eyJ')) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY does not appear to be a JWT token');
  }

  // Determine environment
  let environment: 'development' | 'production' | 'unknown' = 'unknown';
  if (process.env.NODE_ENV === 'development') {
    environment = 'development';
  } else if (process.env.NODE_ENV === 'production') {
    environment = 'production';
  }

  const result: EnvCheckResult = {
    valid: errors.length === 0,
    errors,
    warnings,
    info: {
      supabaseUrl: supabaseUrl || 'MISSING',
      hasAnonKey: !!supabaseAnonKey,
      anonKeyLength: supabaseAnonKey?.length || 0,
      environment,
      isBrowser,
    },
  };

  // Log results in browser
  if (isBrowser) {
    if (result.valid) {
      console.log('✅ Environment verification passed', result.info);
    } else {
      console.error('❌ Environment verification failed', {
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
      });
    }
  }

  return result;
}

export function logEnvironmentStatus() {
  const result = verifyEnvironment();

  if (typeof window !== 'undefined') {
    console.group('🔍 Environment Status');
    console.log('Environment:', result.info.environment);
    console.log('Supabase URL:', result.info.supabaseUrl);
    console.log('Anon Key Present:', result.info.hasAnonKey);
    console.log('Anon Key Length:', result.info.anonKeyLength);

    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }

    if (result.warnings.length > 0) {
      console.warn('Warnings:', result.warnings);
    }

    console.groupEnd();
  }

  return result;
}
