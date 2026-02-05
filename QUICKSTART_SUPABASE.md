# Supabase Setup - Quick Start Checklist

## ✅ Prerequisites
- [x] Supabase project created (Kyarafit)
- [ ] Have your Supabase credentials ready

## 📋 Step-by-step Setup

### 1. Get Credentials from Supabase Dashboard

Go to your Supabase project:

**Settings → API:**
- [ ] Copy **Project URL** (e.g., `https://xxxxxxxxxxxxx.supabase.co`)
- [ ] Copy **anon/public key** (starts with `eyJhbG...`)
- [ ] Copy **JWT Secret** (Settings → API → JWT Settings)

**Settings → Database:**
- [ ] Copy **Connection string** (choose "URI" mode)
- [ ] Replace `[YOUR-PASSWORD]` with your actual database password

### 2. Install Packages

```bash
# Web
cd web
npm install @supabase/supabase-js @supabase/ssr

# Mobile
cd mobile
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install @react-native-async-storage/async-storage
```

### 3. Configure Environment Variables

**Web:** Create `web/.env.local`
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Mobile:** Create `mobile/.env`
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_API_URL=http://localhost:8080
```

**Backend:** Update `backend/.env`
```bash
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
JWT_SECRET=your-jwt-secret-from-supabase
```

### 4. Run Migrations on Supabase

Go to: **Supabase Dashboard → SQL Editor → New Query**

Run these migrations **in order** (copy/paste each file):

- [ ] `backend/migrations/001_init.up.sql`
- [ ] `backend/migrations/002_closet_items.up.sql`
- [ ] `backend/migrations/003_convention_slice.up.sql`
- [ ] `backend/migrations/004_build_image_cost_tasks.up.sql`
- [ ] `backend/migrations/005_tiers_and_usage.up.sql`
- [ ] `backend/migrations/006_supabase_auth_sync.up.sql` ⭐ (Creates user sync trigger)

**Verify:** Table Editor → should see `app_users`, `closet_items`, `device_builds`, etc.

### 5. Test Everything

**Backend:**
```bash
cd backend
go run .
# Should connect to Supabase and start on port 8080
```

**Web:**
```bash
npm run dev:web
# Visit http://localhost:3000/auth/signup
```

**Test signup:**
- [ ] Go to `/auth/signup`
- [ ] Create account with email/password
- [ ] Check email for confirmation link
- [ ] Click confirmation link
- [ ] Go to `/auth/signin` and sign in
- [ ] Should redirect to `/home`

**Verify in Supabase:**
- [ ] Dashboard → Authentication → Users (should see your user)
- [ ] Dashboard → Table Editor → `app_users` (should see FREE tier user)

**Mobile:**
```bash
npm run dev:mobile
# Open Settings → try sign up/sign in
```

### 6. Verify Tier System

**In Supabase SQL Editor, run:**
```sql
-- Check your user was created with FREE tier
SELECT id, tier, current_usage_mb FROM app_users;

-- Try creating a build (web or mobile app)
-- Then check:
SELECT * FROM device_builds WHERE user_id IS NOT NULL;
```

**Test tier limits:**
- [ ] Sign in as FREE user
- [ ] Try creating 6 builds (should fail at 6th with limit message)
- [ ] Check Settings page shows storage usage

### 7. Optional: Configure Supabase Settings

**Email templates** (Dashboard → Authentication → Email Templates):
- Customize confirmation and password reset emails

**Site URL** (Dashboard → Authentication → URL Configuration):
- Add: `http://localhost:3000` (development)
- Add: `https://your-production-domain.com` (production)

**CORS** (Dashboard → Settings → API → CORS):
- Add: `http://localhost:8080` (your Go backend)

## 🎉 You're Done!

Your architecture is now:
```
Web/Mobile (Supabase Auth) → Go Backend (Tier Enforcement) → Supabase DB
```

## 🔥 Next Steps

- [ ] Deploy backend to Fly.io/Railway
- [ ] Deploy web to Vercel
- [ ] Set up Stripe for payments (PREMIUM_BASIC / PREMIUM_PRO)
- [ ] Configure production environment variables
- [ ] Test tier upgrades via Stripe webhook

## 🐛 Troubleshooting

**"Invalid JWT"**
- Check `JWT_SECRET` in backend matches Supabase JWT secret
- Go to Supabase → Settings → API → JWT Settings

**"No app_users record"**
- Run migration 006 (`006_supabase_auth_sync.up.sql`)
- Check trigger exists: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`

**Can't sign up**
- Check Supabase → Authentication → Providers → Email is enabled
- Check email confirmation is required/disabled as needed

**CORS errors from backend**
- Add `http://localhost:8080` to Supabase CORS settings
- Check backend CORS allows your frontend origin

**Database connection fails**
- Verify `DATABASE_URL` password is correct
- Check Supabase → Settings → Database → Connection pooling settings
