# Docker Setup Guide

## Quick Start

1. **Set up credentials** (choose ONE option):

   **Option A: Root `.env` file** (RECOMMENDED):

   ```bash
   # Copy example and edit with your credentials
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

   **Option B: Docker override file**:

   ```bash
   # Copy example and edit with your credentials
   cp docker-compose.override.yml.example docker-compose.override.yml
   # Edit docker-compose.override.yml
   ```

   **Option C: Environment variables**:

   ```bash
   export SUPABASE_URL=https://your-project.supabase.co
   export JWT_SECRET=your-jwt-secret
   export SUPABASE_SERVICE_KEY=your-service-key
   ```

2. **Start services**:

   ```bash
   docker-compose up -d
   ```

3. **Check logs**:

   ```bash
   docker-compose logs -f backend
   ```

4. **Stop services**:
   ```bash
   docker-compose down
   ```

---

## Security Best Practices

### DO NOT commit secrets to git! ⚠️

The `.gitignore` file is configured to protect:

- `.env` (root and subdirectories)
- `docker-compose.override.yml`
- All `.env.*` files except `.env.example`

### Safe files to commit:

- ✅ `docker-compose.yml` (with placeholder values like `${SUPABASE_URL}`)
- ✅ `.env.example` (with fake/example values)
- ✅ `docker-compose.override.yml.example` (with fake/example values)

### Files to NEVER commit:

- ❌ `.env` (contains actual secrets)
- ❌ `docker-compose.override.yml` (contains actual secrets)
- ❌ `backend/.env` with real Supabase credentials

### How docker-compose reads credentials:

1. **Base config**: `docker-compose.yml` (committed to git)
2. **Secrets from**: `.env` file OR `docker-compose.override.yml` (gitignored)
3. **Merging**: Override file values take precedence over base config

Example:

```yaml
# docker-compose.yml (committed)
services:
  backend:
    environment:
      - SUPABASE_URL=${SUPABASE_URL:-https://placeholder.supabase.co}

# .env (gitignored)
SUPABASE_URL=https://real-project.supabase.co
```

---

## Services

### PostgreSQL (`postgres`)

- **Port**: 5432
- **Database**: kyarafit
- **User**: kyarafit
- **Password**: kyarafit
- **Healthcheck**: Enabled
- **Data**: Persisted in `postgres_data` volume

### Backend (`backend`)

- **Port**: 8080
- **Language**: Go (Fiber framework)
- **Migrations**: Automatically run on startup
- **Healthcheck**: `GET /health`
- **Dependencies**: PostgreSQL (waits for healthy status)

### Image Service (`image-service`)

- **Port**: 8000
- **Language**: Python (FastAPI)
- **Purpose**: Background removal (stub implementation)

---

## Troubleshooting

### Issue: "No .env file found"

**Cause**: Backend expects `.env` file, but Docker uses environment variables from `docker-compose.yml`

**Fix**: This is just a warning. Environment variables are set via docker-compose. You can ignore this message.

### Issue: "Failed to run migrations: no such file or directory"

**Cause**: Migrations directory not copied to Docker image correctly

**Fixes**:

1. Rebuild the image:

   ```bash
   docker-compose build --no-cache backend
   docker-compose up backend
   ```

2. Verify migrations are in the image:

   ```bash
   docker-compose run --rm backend ls -la /root/migrations
   ```

3. Check Dockerfile COPY command (should show migrations files):
   ```dockerfile
   COPY --from=builder /app/migrations/ ./migrations/
   RUN ls -la ./migrations/
   ```

### Issue: "Failed to connect to database"

**Cause**: PostgreSQL not ready or wrong connection string

**Fixes**:

1. Check PostgreSQL is running:

   ```bash
   docker-compose ps
   docker-compose logs postgres
   ```

2. Verify DATABASE_URL in `docker-compose.yml`:

   ```yaml
   DATABASE_URL=postgres://kyarafit:kyarafit@postgres:5432/kyarafit?sslmode=disable
   ```

   Note: Use `@postgres` (service name), not `@localhost`

3. Wait for PostgreSQL healthcheck:
   ```bash
   docker-compose up postgres
   # Wait for "database system is ready to accept connections"
   docker-compose up backend
   ```

### Issue: "JWT validation failed"

**Cause**: Missing or incorrect Supabase environment variables

**Fix**: Set these in `docker-compose.yml` or via environment:

```yaml
- SUPABASE_URL=https://your-project.supabase.co
- JWT_SECRET=your-jwt-secret-from-supabase-project-settings
- SUPABASE_SERVICE_KEY=your-service-role-key
```

Get these from: Supabase Dashboard → Project Settings → API

### Issue: Backend container exits immediately

**Cause**: Migration or database connection failure

**Fixes**:

1. Check logs:

   ```bash
   docker-compose logs backend
   ```

2. Run backend interactively to see full error:

   ```bash
   docker-compose run --rm backend
   ```

3. Connect to container to debug:
   ```bash
   docker-compose run --rm backend /bin/sh
   ls -la /root/migrations
   ./main
   ```

---

## Development Workflow

### Rebuild after code changes

```bash
# Rebuild and restart specific service
docker-compose up -d --build backend

# Rebuild everything from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 50 lines
docker-compose logs --tail=50 backend
```

### Database access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U kyarafit -d kyarafit

# Run SQL file
docker-compose exec -T postgres psql -U kyarafit -d kyarafit < backup.sql
```

### Clean slate

```bash
# Stop and remove containers, networks
docker-compose down

# Also remove volumes (deletes database data!)
docker-compose down -v
```

---

## Production Deployment

For production, use:

- **Supabase PostgreSQL** (not local Docker postgres)
- **Fly.io** or similar for backend container
- **Supabase Storage** for images

Update `DATABASE_URL` to your Supabase connection string:

```
postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres?sslmode=require
```

See `backend/fly.toml` for Fly.io configuration.

---

## Environment Variables Reference

### Backend (`docker-compose.yml`)

| Variable               | Required | Default                   | Description                        |
| ---------------------- | -------- | ------------------------- | ---------------------------------- |
| `PORT`                 | No       | 8080                      | HTTP server port                   |
| `HOST`                 | No       | 0.0.0.0                   | HTTP server host                   |
| `DATABASE_URL`         | Yes      | -                         | PostgreSQL connection string       |
| `MIGRATIONS_PATH`      | No       | /root/migrations          | Path to SQL migrations             |
| `SUPABASE_URL`         | Yes      | -                         | Supabase project URL               |
| `JWT_SECRET`           | Yes      | -                         | Supabase JWT secret for validation |
| `SUPABASE_SERVICE_KEY` | Yes      | -                         | Supabase service role key          |
| `IMAGE_SERVICE_URL`    | No       | http://image-service:8000 | Image processing service URL       |
| `STRIPE_PRICE_BASIC`   | No       | -                         | Stripe price ID for Basic tier     |
| `STRIPE_PRICE_PRO`     | No       | -                         | Stripe price ID for Pro tier       |

### How to get Supabase credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → For web/mobile clients
   - **service_role** key → `SUPABASE_SERVICE_KEY` (backend only, keep secret!)
5. Go to **Settings** → **API** → **JWT Settings**
6. Copy **JWT Secret** → `JWT_SECRET`

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild backend
docker-compose build --no-cache backend

# View logs
docker-compose logs -f backend

# Check service health
docker-compose ps

# Connect to backend container
docker-compose exec backend /bin/sh

# Run database migrations manually
docker-compose exec backend ./main

# Clean and restart
docker-compose down -v && docker-compose up -d
```
