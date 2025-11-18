# Production Setup & Troubleshooting Guide

This guide will help you deploy your application and troubleshoot common issues with blank screens and missing data.

## Quick Diagnostics

Visit `/admin/db-diagnostic` to run automatic database connection tests and see detailed error information.

## Environment Variables Setup

### Required Variables

Your production environment MUST have these variables set:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### How to Get These Values

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Go to Settings > API
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Setting Environment Variables

#### On Netlify
1. Go to Site Settings > Environment Variables
2. Add both variables
3. Redeploy your site

#### On Vercel
1. Go to Project Settings > Environment Variables
2. Add both variables for Production
3. Redeploy

#### On Other Platforms
Check your platform's documentation for setting environment variables.

## Supabase Configuration

### 1. CORS Configuration

Add your production domain to Supabase:

1. Go to Supabase Dashboard
2. Settings > API > CORS
3. Add your production URL (e.g., `https://yourdomain.com`)

### 2. Auth Configuration

Set up redirect URLs:

1. Go to Authentication > URL Configuration
2. Set **Site URL** to your production URL
3. Add **Redirect URLs**:
   - `https://yourdomain.com/auth/callback`
   - `https://yourdomain.com/**`

### 3. Row Level Security (RLS)

Your tables should have these policies enabled:

#### Posts Table
- ✅ "Posts are viewable by everyone" (SELECT for authenticated users)
- ✅ "Authenticated users can create posts" (INSERT)
- ✅ "Users can update their own posts" (UPDATE)
- ✅ "Users can delete their own posts" (DELETE)

#### Profiles Table
- ✅ "Profiles are viewable by everyone" (SELECT for authenticated users)
- ✅ "Users can update their own profile" (UPDATE)
- ✅ "Users can insert their own profile" (INSERT)

Check RLS in: Supabase Dashboard > Authentication > Policies

## Common Issues & Solutions

### Issue 1: Blank Feed / No Posts Showing

**Symptoms:**
- Feed page loads but shows no content
- Loading spinner goes away but no posts appear
- No errors in console

**Solutions:**

1. **Check if data exists:**
   ```sql
   SELECT COUNT(*) FROM posts;
   SELECT COUNT(*) FROM profiles;
   ```
   Run this in Supabase SQL Editor. If counts are 0, you need to create test data.

2. **Verify authentication:**
   - Open browser console (F12)
   - Look for "[Feed] User status:" logs
   - Ensure user is authenticated

3. **Check RLS policies:**
   - Go to Table Editor in Supabase
   - Click on `posts` table
   - Verify "Posts are viewable by everyone" policy exists

4. **Test database connection:**
   - Visit `/admin/db-diagnostic`
   - Check all tests pass

### Issue 2: "Failed to Fetch" or Network Errors

**Symptoms:**
- Errors mentioning "Failed to fetch"
- Network timeout errors
- CORS errors in console

**Solutions:**

1. **Verify environment variables:**
   ```javascript
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
   ```
   Should print your Supabase URL, not `undefined`

2. **Check CORS settings:**
   - Add production domain to Supabase CORS settings
   - Restart/redeploy after adding

3. **Verify Supabase project is active:**
   - Log into Supabase Dashboard
   - Ensure project is not paused

### Issue 3: Authentication Not Working

**Symptoms:**
- Can't sign in
- Redirects not working
- Session not persisting

**Solutions:**

1. **Update redirect URLs in Supabase:**
   - Add all production URLs
   - Include wildcards: `https://yourdomain.com/**`

2. **Check localStorage:**
   - Open browser DevTools > Application > Local Storage
   - Look for `reseautageclub-auth` key
   - Clear if corrupted

3. **Verify email confirmation is disabled:**
   ```sql
   -- Check in Supabase Dashboard > Authentication > Settings
   -- "Enable email confirmations" should be OFF for development
   ```

### Issue 4: Messages/Conversations Not Loading

**Symptoms:**
- Messages page is blank
- Can't see conversations
- Can't send messages

**Solutions:**

1. **Check RLS policies on messages table:**
   - Users should be able to SELECT messages they sent or received
   - Check policy includes: `sender_id = auth.uid() OR receiver_id = auth.uid()`

2. **Verify connections exist:**
   ```sql
   SELECT * FROM connections WHERE status = 'accepted';
   ```
   Messages only work between connected users

## Database Connection Logging

All database queries are logged to the browser console with `[DB]` prefix:

- `[DB] Fetching posts` - Query starting
- `[DB] Fetched posts successfully: 10` - Success
- `[DB] Error fetching posts:` - Error with details

Open browser console (F12) to see these logs.

## Testing in Production

After deploying:

1. **Open browser DevTools Console (F12)**
2. **Navigate to your site**
3. **Look for these logs:**
   - `[AuthContext]` - Authentication status
   - `[DB]` - Database queries
   - `[Feed]` - Feed loading status

4. **Check for errors:**
   - Red error messages
   - Failed network requests
   - RLS policy violations

## Manual Verification Checklist

- [ ] Environment variables are set in deployment platform
- [ ] Supabase CORS includes production domain
- [ ] Auth redirect URLs include production domain
- [ ] RLS policies allow authenticated users to read data
- [ ] Test data exists in database tables
- [ ] Browser console shows successful authentication
- [ ] Browser console shows successful data fetching
- [ ] No CORS errors in console
- [ ] No "Failed to fetch" errors

## Getting Help

If issues persist:

1. Visit `/admin/db-diagnostic` and screenshot results
2. Open browser console (F12) and screenshot any errors
3. Check Supabase Dashboard > Logs for server-side errors
4. Verify all environment variables are correctly set

## Development vs Production

**Important:** Make sure BOTH development and production use the SAME Supabase project URL and keys. This ensures:
- Data created in development appears in production
- Testing is accurate
- No confusion between environments

If you need separate dev/prod databases, create two Supabase projects and use different environment variables for each.
