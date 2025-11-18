/**
 * RLS Security Verification Script
 *
 * This script verifies that Row Level Security is properly configured on all tables.
 * It checks:
 * 1. RLS is enabled on all tables
 * 2. Each table has appropriate policies
 * 3. Policies properly restrict access based on auth.uid()
 *
 * Run with: tsx scripts/verify-rls-security.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TableInfo {
  tablename: string;
  schemaname: string;
}

interface RLSStatus {
  tablename: string;
  rowsecurity: boolean;
}

interface PolicyInfo {
  tablename: string;
  policyname: string;
  cmd: string;
  qual: string;
  with_check: string;
}

const CRITICAL_TABLES = [
  'profiles',
  'posts',
  'post_likes',
  'post_comments',
  'connections',
  'messages',
  'communities',
  'community_members',
  'community_posts',
  'events',
  'event_attendees',
  'notifications',
  'call_requests',
  'call_signaling',
  'blocked_users',
  'user_rooms',
  'cofounder_profiles',
  'profile_views',
  'profile_follows',
];

async function getAllTables(): Promise<string[]> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE 'sql_%'
      ORDER BY tablename;
    `
  });

  if (error) {
    // Fallback: try direct query if RPC doesn't exist
    const { data: tables } = await supabase
      .from('information_schema.tables' as any)
      .select('table_name')
      .eq('table_schema', 'public');

    if (tables) {
      return tables.map((t: any) => t.table_name);
    }

    console.warn('⚠️  Could not fetch tables list, using critical tables only');
    return CRITICAL_TABLES;
  }

  return data?.map((row: any) => row.tablename) || CRITICAL_TABLES;
}

async function checkRLSEnabled(tableName: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = '${tableName}';
    `
  });

  if (error || !data || data.length === 0) {
    return false;
  }

  return data[0].rowsecurity === true;
}

async function getTablePolicies(tableName: string): Promise<PolicyInfo[]> {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        tablename,
        policyname,
        cmd,
        qual::text,
        with_check::text
      FROM pg_policies
      WHERE schemaname = 'public'
      AND tablename = '${tableName}'
      ORDER BY policyname;
    `
  });

  if (error || !data) {
    return [];
  }

  return data;
}

function analyzePolicySecurity(policy: PolicyInfo): {
  score: 'good' | 'warning' | 'critical';
  issues: string[];
} {
  const issues: string[] = [];
  let score: 'good' | 'warning' | 'critical' = 'good';

  // Check for overly permissive policies
  if (policy.qual && policy.qual.includes('true')) {
    issues.push('Policy uses USING (true) which allows all access');
    score = 'critical';
  }

  // Check if auth.uid() is used
  const hasAuthCheck =
    (policy.qual && policy.qual.includes('auth.uid()')) ||
    (policy.with_check && policy.with_check.includes('auth.uid()'));

  if (!hasAuthCheck && policy.cmd !== 'SELECT') {
    issues.push('Policy does not check auth.uid() for write operations');
    score = score === 'critical' ? 'critical' : 'warning';
  }

  // Check SELECT policies have USING clause
  if (policy.cmd === 'SELECT' && !policy.qual) {
    issues.push('SELECT policy missing USING clause');
    score = score === 'critical' ? 'critical' : 'warning';
  }

  // Check INSERT policies have WITH CHECK clause
  if (policy.cmd === 'INSERT' && !policy.with_check) {
    issues.push('INSERT policy missing WITH CHECK clause');
    score = score === 'critical' ? 'critical' : 'warning';
  }

  // Check UPDATE policies have both USING and WITH CHECK
  if (policy.cmd === 'UPDATE') {
    if (!policy.qual) {
      issues.push('UPDATE policy missing USING clause');
      score = score === 'critical' ? 'critical' : 'warning';
    }
    if (!policy.with_check) {
      issues.push('UPDATE policy missing WITH CHECK clause');
      score = score === 'critical' ? 'critical' : 'warning';
    }
  }

  // Check DELETE policies have USING clause
  if (policy.cmd === 'DELETE' && !policy.qual) {
    issues.push('DELETE policy missing USING clause');
    score = score === 'critical' ? 'critical' : 'warning';
  }

  return { score, issues };
}

async function verifyRLSSecurity() {
  console.log('🔒 Starting RLS Security Verification\n');

  const tables = await getAllTables();
  console.log(`📊 Found ${tables.length} tables to verify\n`);

  let criticalIssues = 0;
  let warnings = 0;
  let tablesWithoutRLS = 0;
  let tablesWithoutPolicies = 0;

  for (const table of tables) {
    const rlsEnabled = await checkRLSEnabled(table);
    const policies = await getTablePolicies(table);

    if (!rlsEnabled) {
      console.log(`❌ ${table}: RLS NOT ENABLED`);
      tablesWithoutRLS++;
      criticalIssues++;
      continue;
    }

    if (policies.length === 0) {
      console.log(`⚠️  ${table}: RLS enabled but NO POLICIES (table is locked down)`);
      tablesWithoutPolicies++;
      continue;
    }

    let tableHasIssues = false;

    for (const policy of policies) {
      const analysis = analyzePolicySecurity(policy);

      if (analysis.score === 'critical') {
        console.log(`❌ ${table}.${policy.policyname} (${policy.cmd}): CRITICAL`);
        analysis.issues.forEach(issue => console.log(`   - ${issue}`));
        criticalIssues++;
        tableHasIssues = true;
      } else if (analysis.score === 'warning') {
        console.log(`⚠️  ${table}.${policy.policyname} (${policy.cmd}): WARNING`);
        analysis.issues.forEach(issue => console.log(`   - ${issue}`));
        warnings++;
        tableHasIssues = true;
      }
    }

    if (!tableHasIssues) {
      console.log(`✅ ${table}: ${policies.length} policies configured properly`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 RLS Security Report Summary\n');
  console.log(`Total tables checked: ${tables.length}`);
  console.log(`❌ Tables without RLS: ${tablesWithoutRLS}`);
  console.log(`⚠️  Tables without policies: ${tablesWithoutPolicies}`);
  console.log(`❌ Critical security issues: ${criticalIssues}`);
  console.log(`⚠️  Warnings: ${warnings}`);

  if (criticalIssues > 0) {
    console.log('\n⚠️  CRITICAL: Your application has serious security vulnerabilities!');
    console.log('Fix these issues immediately before deploying to production.');
    process.exit(1);
  } else if (tablesWithoutRLS > 0 || warnings > 0) {
    console.log('\n⚠️  Your application has some security concerns.');
    console.log('Review and fix warnings before deploying to production.');
    process.exit(1);
  } else {
    console.log('\n✅ All security checks passed!');
    console.log('Your RLS configuration looks good.');
    process.exit(0);
  }
}

// Run the verification
verifyRLSSecurity().catch((error) => {
  console.error('❌ Error running RLS verification:', error);
  process.exit(1);
});
