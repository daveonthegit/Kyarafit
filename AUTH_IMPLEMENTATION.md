# Authentication Implementation Summary

## Overview

Kyarafit now uses **Supabase Auth** across all platforms with tiered access control. The implementation respects the different use cases of web (editor-focused, requires login) and mobile (offline-first, optional sync).

---

## Web App

### Features
- **Login-gated**: All app features require authentication (FREE+ tier)
- **Landing page**: Public marketing page with app download links
- **Tier enforcement**: Backend validates JWT on all API requests to `/api/v1/*`

### User Flow

#### Anonymous Users
1. Land on `/` → See marketing landing page with:
   - App download buttons (iOS/Android)
   - Feature highlights
   - "Get Started on Web" button → `/auth/signup`
   - "Log In" link → `/auth/signin`

2. Sign up → Email confirmation required
3. Sign in → Redirected to `/home` (authenticated app)

#### Authenticated Users
- Full access to web editor
- Settings shows:
  - Current tier (FREE, PREMIUM_BASIC, PREMIUM_PRO)
  - Storage usage
  - Upgrade message for FREE users
  - "Sign Out" button

### Technical Implementation

**Auth Client** (`web/src/lib/auth/client.ts`):
```typescript
export function useSession() {
  return { session, loading };
}
export async function signOut() { ... }
export const signIn = { email: async ({ email, password }) => { ... } };
export const signUp = { email: async ({ email, password }) => { ... } };
```

**Auth Gate** (`web/src/components/AuthGate.tsx`):
- Public paths: `/`, `/auth/signin`, `/auth/signup`
- All other routes require authentication
- Redirects to `/auth/signin` if not logged in

**API Integration**:
- All API calls include `Authorization: Bearer <token>` header
- All API calls include `x-kyar-client: web` header
- Backend enforces FREE+ tier for web access

---

## Mobile App

### Features
- **Offline-first**: No auth required for local use
- **Optional sync**: Sign in to enable backup and multi-device sync (PREMIUM_BASIC+)
- **Local SQLite**: Always the source of truth

### User Flow

#### Anonymous Users
1. App starts directly in tabs (local-only mode)
2. Full functionality with local storage
3. Settings shows:
   - "Local-only mode"
   - "Sign in to sync across devices"
   - "Sign In or Create Account" button → `/auth`
4. No backend sync attempts

#### Authenticated Users (FREE)
- All local functionality
- Minimal web editing capability (if they use web app)
- No backup or export
- Settings shows:
  - Tier info
  - "Upgrade for backup and export"
  - "Sign Out" button

#### Authenticated Users (PREMIUM_BASIC+)
- Full sync with backend
- Backup enabled
- Multi-device sync
- Export capabilities (tier-dependent)

### Technical Implementation

**Auth Client** (`mobile/src/lib/auth/client.ts`):
```typescript
export function useSession() {
  return { session, loading };
}
export async function signOut() { ... }
export const signIn = { email: async ({ email, password }) => { ... } };
export const signUp = { email: async ({ email, password }) => { ... } };
```

**Auth Screen** (`mobile/app/auth.tsx`, `mobile/src/screens/AuthScreen.tsx`):
- Sign in / sign up forms
- "Continue without account" skip button
- Styled with Kyarafit design system
- Navigates to `/(tabs)` after successful auth

**Sync Integration** (`mobile/src/services/sync.ts`):
- `runSync(token)` accepts optional token
- If token is null → no backend requests
- If token present → includes `Authorization` and `x-kyar-client: mobile` headers
- Called on app mount and when app becomes active

**Root Layout** (`mobile/app/_layout.tsx`):
- Initializes database and device ID
- Fetches token with `getTokenForSync()`
- Runs sync with token (or null)
- Does NOT force auth on startup
- Redirects away from `/auth` if already logged in

---

## Backend Enforcement

### Web API Routes (`/api/v1/*`)
- Middleware: `RequireWebAccess`
- Requires valid JWT
- Requires tier >= FREE
- Returns 401 if not authenticated

### Device-scoped Routes (`/closet`, `/builds`, `/conventions`)
- Middleware: `OptionalAppUser`
- JWT optional (device-scoped for anonymous)
- Associates data with `user_id` if JWT present
- Write operations check `AllowSyncWrite`:
  - Web (`x-kyar-client: web`): Allowed with FREE+
  - Mobile (`x-kyar-client: mobile`): Requires PREMIUM_BASIC+

### Tier Limits
- Storage quotas enforced on upload
- Build/convention counts checked on create
- Calm error messages on limit reached
- No data deletion on downgrade

---

## Parity Summary

| Feature | Web | Mobile |
|---------|-----|--------|
| **Auth Required** | Yes (FREE+) | No (optional) |
| **Landing Page** | Yes (public) | N/A |
| **Offline-first** | No | Yes |
| **Sign In/Up** | Email/password | Email/password |
| **Session Hook** | `useSession()` → `{ session, loading }` | `useSession()` → `{ session, loading }` |
| **Sign Out** | Settings button | Settings button |
| **Sync** | Always (when logged in) | Only PREMIUM_BASIC+ |
| **Storage Backend** | Supabase | Local SQLite + Supabase |
| **API Headers** | `x-kyar-client: web` | `x-kyar-client: mobile` |

---

## Environment Setup

### Web (`.env.local`)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Mobile (`.env`)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### Backend (`.env`)
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_SERVICE_KEY=eyJxxx
DATABASE_URL=postgresql://postgres.xxx:5432/postgres?sslmode=require
```

---

## Testing Checklist

### Web
- [ ] Anonymous user sees landing page with app download section
- [ ] Anonymous user can sign up (gets email confirmation)
- [ ] Anonymous user can sign in
- [ ] Authenticated user redirected to `/home`
- [ ] Authenticated user can access all app features
- [ ] Authenticated user can sign out → redirected to `/`
- [ ] Protected routes redirect to `/auth/signin` if not logged in

### Mobile
- [ ] App starts in tabs without auth prompt
- [ ] Anonymous user has full local functionality
- [ ] Anonymous user sees "Local-only mode" in Settings
- [ ] Anonymous user can click "Sign In or Create Account"
- [ ] Authenticated user sees tier info in Settings
- [ ] Authenticated user can sign out
- [ ] PREMIUM_BASIC+ user syncs with backend
- [ ] FREE user does NOT sync with backend

### Backend
- [ ] Web requests to `/api/v1/*` require FREE+ tier
- [ ] Mobile sync requests require PREMIUM_BASIC+ tier
- [ ] Storage limits enforced on upload
- [ ] Build/convention limits enforced on create
- [ ] JWT validation works for both web and mobile
- [ ] New Supabase users automatically get FREE tier in `app_users`

---

## Next Steps

1. **Deploy**: Set up production Supabase project and update environment variables
2. **Stripe Integration**: Implement webhook handler for subscription tier updates
3. **Email Templates**: Customize Supabase email templates for branding
4. **App Store**: Update app store listing URLs in landing page
5. **Analytics**: Add tracking for sign-ups, tier usage, and feature adoption
