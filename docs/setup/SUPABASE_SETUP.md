# Supabase Setup Guide

## 1. Install packages

### Web
```bash
cd web
npm install @supabase/supabase-js @supabase/ssr
```

### Mobile
```bash
cd mobile
npm install @supabase/supabase-js @react-native-async-storage/async-storage
npx expo install @react-native-async-storage/async-storage
```

## 2. Run migrations on Supabase

Go to your Supabase project → SQL Editor → New query

Run each migration file in order:
1. `backend/migrations/001_init.up.sql`
2. `backend/migrations/002_closet_items.up.sql`
3. `backend/migrations/003_convention_slice.up.sql`
4. `backend/migrations/004_build_image_cost_tasks.up.sql`
5. `backend/migrations/005_tiers_and_usage.up.sql`
6. `backend/migrations/006_supabase_auth_sync.up.sql`

Or use the SQL Editor to paste and run all at once.

## 3. Configure environment variables

### Web (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Mobile (.env)
```bash
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=http://localhost:8080
```

### Backend (.env)
```bash
DATABASE_URL=postgresql://postgres:[password]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
JWT_SECRET=your-jwt-secret
STRIPE_PRICE_BASIC=price_xxx
STRIPE_PRICE_PRO=price_yyy
```

## 4. Get your Supabase credentials

From Supabase Dashboard → Settings → API:
- **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
- **anon (public) key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **service_role key**: (for backend only, keep secret!)

From Settings → API → JWT Settings:
- **JWT Secret**: (for backend JWT validation)

From Settings → Database → Connection string:
- **Connection string**: `postgresql://postgres:[password]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres`

## 5. Test the setup

### Test auth in web
```bash
npm run dev:web
# Visit http://localhost:3000/auth/signin
# Try signing up with email/password
```

### Test auth in mobile
```bash
npm run dev:mobile
# Open Settings → try sign up
```

### Verify in Supabase
- Dashboard → Authentication → Users
- Should see new user after signup
- Dashboard → Table Editor → app_users
- Should see FREE tier user automatically created

## 6. Update docker-compose.yml (optional)

For local development, you can keep using Docker Compose Postgres, or switch to Supabase for everything:

```yaml
# Comment out postgres service if using Supabase for local dev too
# services:
#   postgres:
#     ...
```

## Architecture reminder

```
┌─────────────────┐
│  Web / Mobile   │
│  (Supabase Auth)│ ← Sign in/up
└────────┬────────┘
         │ JWT token
         ↓
┌─────────────────┐
│   Go Backend    │ ← All API calls (tier enforcement)
│   Validates JWT │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Supabase DB   │ ← PostgreSQL + auth.users
│   app_users     │   (synced via trigger)
└─────────────────┘
```

## Troubleshooting

**"Invalid JWT"**: Check that `JWT_SECRET` in backend matches Supabase JWT secret

**"No app_user found"**: Run migration 006 to create the trigger

**CORS errors**: Supabase → Settings → API → CORS → Add `http://localhost:8080`

**Can't connect from backend**: Check DATABASE_URL connection string and password
