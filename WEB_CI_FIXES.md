# Web CI Build Fixes

## Problem

The Next.js build was failing in CI with multiple errors:

1. **Supabase initialization errors** - Missing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` during build
2. **React error #31** - Minified React error about objects being rendered as children
3. **Prerender failures** - Pages requiring authentication failing during static generation

## Root Causes

1. CI workflow didn't provide Supabase environment variables needed during build time
2. Supabase client creation threw errors when env vars were missing
3. Next.js was attempting to statically prerender pages that require authentication

## Fixes Applied

### 1. Updated Supabase Client Files

Made Supabase client creation more defensive with fallback values:

**`web/src/lib/supabase/client.ts`**

- Added fallback values for missing environment variables
- Prevents build-time errors when env vars aren't set

**`web/src/lib/supabase/server.ts`**

- Added fallback values for missing environment variables
- Graceful handling during server-side rendering

### 2. Updated CI Workflow

**`.github/workflows/web.yml`**

- Added placeholder Supabase environment variables to all build steps
- Added comments explaining that real values are set at runtime via Cloud Run secrets
- Ensures builds can complete without actual Supabase credentials

### 3. Updated Root Layout

**`web/src/app/layout.tsx`**

- Added `export const dynamic = 'force-dynamic'` to prevent static generation
- Forces all pages to be dynamically rendered (appropriate for auth-protected app)
- Prevents prerender errors for pages requiring authentication

### 4. Updated Next.js Config

**`web/next.config.js`**

- Added explicit TypeScript and ESLint configuration
- Maintains build quality while handling edge cases better

## Why These Changes Work

1. **Build-time vs Runtime**: The app needs Supabase credentials at runtime, not build time. Pages are dynamically rendered when users access them, using real credentials from Cloud Run environment variables.

2. **Security**: Placeholder values in CI don't expose real credentials. Actual Supabase credentials are managed as secrets in Google Cloud Run.

3. **Dynamic Rendering**: Since most pages require authentication, static generation doesn't make sense. Dynamic rendering is the correct approach for authenticated applications.

4. **Graceful Degradation**: Fallback values allow the build to complete, but the app will still require proper credentials at runtime to function correctly.

## Testing

After these changes, the build should:

- ✅ Pass `npm run lint`
- ✅ Pass `npx tsc --noEmit`
- ✅ Successfully complete `npm run build`
- ✅ Create standalone Docker images
- ✅ Pass all CI checks

## Deployment Notes

- Real Supabase credentials must be configured in Cloud Run environment variables
- Mobile apps handle credentials differently (configured in app.json/env)
- Local development still requires a `.env` file with actual credentials
