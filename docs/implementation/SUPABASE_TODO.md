# Supabase Setup - Final Steps

## ✅ Completed:

- [x] Created Supabase project
- [x] Environment files configured
- [x] Supabase packages installed (web + mobile)

## 📋 What's Left:

### 1. Get JWT Secret (5 minutes)

1. Go to: **Supabase Dashboard → Settings → API**
2. Scroll to **"JWT Settings"**
3. Copy the **JWT Secret**
4. Update `backend/.env` line 13:
   ```bash
   JWT_SECRET=paste-here
   ```

### 2. Run Migrations on Supabase (10 minutes)

Go to: **Supabase Dashboard → SQL Editor → New Query**

Copy/paste each file **in order** and click **"Run"**:

- [ ] `backend/migrations/001_init.up.sql`
- [ ] `backend/migrations/002_closet_items.up.sql`
- [ ] `backend/migrations/003_convention_slice.up.sql`
- [ ] `backend/migrations/004_build_image_cost_tasks.up.sql`
- [ ] `backend/migrations/005_tiers_and_usage.up.sql`
- [ ] `backend/migrations/006_supabase_auth_sync.up.sql` ⭐ Important!

**Verify:** Table Editor → should see `app_users`, `closet_items`, `device_builds`

### 3. Test It! (5 minutes)

**Start backend:**

```bash
cd backend
go run .
```

Should see: `Successfully connected to database` ✅

**Start web:**

```bash
npm run dev:web
```

Visit: http://localhost:3000/auth/signup

- [ ] Sign up with email/password
- [ ] Check email for confirmation link
- [ ] Click link to verify
- [ ] Sign in at `/auth/signin`
- [ ] Should redirect to `/home`

**Verify in Supabase:**

- [ ] Authentication → Users (see your user)
- [ ] Table Editor → `app_users` (see FREE tier user created automatically!)

### 4. Test Tier System (2 minutes)

While signed in:

- [ ] Go to Settings → should show tier and storage
- [ ] Create a build → should work
- [ ] Try creating 6 builds → 6th should fail with limit message

### 5. Test Mobile (optional)

```bash
npm run dev:mobile
```

- [ ] Open app → should work offline
- [ ] Settings → sign in
- [ ] Should sync to backend

## 🐛 If Something Breaks:

**"Invalid JWT"**
→ Check JWT_SECRET matches Supabase

**"No app_users record"**
→ Run migration 006 again

**"Can't connect to database"**
→ Check DATABASE_URL is correct (for now keep using Docker Compose)

**CORS error**
→ Backend CORS already allows localhost:3000, you're good!

## 🎉 When Done:

Your tier system will be fully working:

- FREE users: 5 builds, 1 convention, 50MB storage
- Web requires sign-in
- Mobile syncs only with PREMIUM_BASIC+
- Storage limits enforced
