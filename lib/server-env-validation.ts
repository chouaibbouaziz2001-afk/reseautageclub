/**
 * Server-side environment variable validation
 * Use this in API routes and server components to ensure required env vars are present
 */

interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate required environment variables for server-side code
 * @param requiredVars - Array of required environment variable names
 * @param optionalVars - Array of optional environment variable names (will generate warnings if missing)
 * @returns Validation result
 */
export function validateServerEnv(
  requiredVars: string[] = [],
  optionalVars: string[] = []
): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      missing.push(varName);
    }
  }

  // Check optional variables (warn if missing)
  for (const varName of optionalVars) {
    const value = process.env[varName];
    if (!value || value.trim() === '') {
      warnings.push(`${varName} is not set (optional but recommended)`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Validate Supabase environment variables
 */
export function validateSupabaseEnv(): EnvValidationResult {
  return validateServerEnv(
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY']
  );
}

/**
 * Validate WebRTC encryption environment variables
 */
export function validateWebRTCEnv(): EnvValidationResult {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    return validateServerEnv(
      ['WEBRTC_ENCRYPTION_KEY'],
      []
    );
  }
  
  // In development, WebRTC key is optional
  return validateServerEnv(
    [],
    ['WEBRTC_ENCRYPTION_KEY']
  );
}

/**
 * Get environment variable or throw error if missing
 * @param varName - Environment variable name
 * @param defaultValue - Optional default value
 * @returns Environment variable value
 * @throws Error if variable is missing and no default provided
 */
export function requireEnv(varName: string, defaultValue?: string): string {
  const value = process.env[varName] || defaultValue;
  
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${varName}. ` +
      `Please set it in your .env.local file or environment configuration.`
    );
  }
  
  return value;
}

