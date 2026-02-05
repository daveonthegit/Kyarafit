# Authentication Guide

## Overview

Kyarafit uses **Supabase Auth** with **JWT Bearer tokens** for authentication. This document explains how authentication works, how to set it up, and how to troubleshoot common issues.

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Frontend  │────────▶│  Supabase    │────────▶│   Backend   │
│  (Next.js)  │         │    Auth      │         │    (Go)     │
└─────────────┘         └──────────────┘         └─────────────┘
      │                        │                         │
      │ 1. Sign in/up         │ 2. Issues JWT            │
      │────────────────────────▶                         │
      │                        │                         │
      │ 3. Store token         │                         │
      │◀───────────────────────                          │
      │                        │                         │
      │ 4. API request with Authorization: Bearer <token>│
      │──────────────────────────────────────────────────▶
      │                        │                         │
      │                        │ 5. Validate JWT using   │
      │                        │    JWT_SECRET           │
      │                        │◀────────────────────────│
      │                        │                         │
      │ 6. Response (200 or 401)                         │
      │◀──────────────────────────────────────────────────
```

### Authentication Flow

1. **User signs in/up** via Supabase Auth (frontend)
2. **Supabase issues a JWT** signed with its JWT secret
3. **Frontend stores the token** in memory (managed by Supabase client)
4. **Frontend sends API requests** with `Authorization: Bearer <token>` header
5. **Backend validates the JWT** using the same JWT_SECRET from Supabase
6. **Backend returns response** (200 if valid, 401 if invalid/expired)

## Environment Setup

### Backend (`.env` in project root)

```bash
# Supabase Configuration (REQUIRED)
# Get from: https://app.supabase.com → Your Project → Settings → API
SUPABASE_URL=https://your-project.supabase.co

# IMPORTANT: This is the JWT Secret, NOT the anon key!
# Find it at: Project Settings → API → JWT Secret (click "Reveal")
JWT_SECRET=your-jwt-secret-here

# Service role key for admin operations
SUPABASE_SERVICE_KEY=your-service-role-key

# Database (REQUIRED)
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# CORS Origins (comma-separated)
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:8081,http://127.0.0.1:3000,http://127.0.0.1:8081

# Server
PORT=8080
HOST=0.0.0.0

# SMTP (OPTIONAL - app will start without these)
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USERNAME=resend
SMTP_PASSWORD=your-api-key
SMTP_FROM=Kyarafit <noreply@yourdomain.com>

# Application URL
APP_URL=http://localhost:3000
```

### Frontend (`web/.env.local`)

```bash
# Supabase (for auth)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Key Differences:**

- Backend needs the **JWT Secret** (for validating tokens)
- Frontend needs the **Anon Key** (for Supabase client initialization)

## Docker Setup

The `docker-compose.yml` is configured to load environment variables:

```yaml
backend:
  env_file:
    - .env
  environment:
    - JWT_SECRET=${JWT_SECRET}
    - DATABASE_URL=${DATABASE_URL}
    - SUPABASE_URL=${SUPABASE_URL}
    - CORS_ORIGINS=${CORS_ORIGINS}
    # ... other variables
```

**Important:** Make sure your `.env` file exists in the project root before running `docker-compose up`.

## Security

### Why Bearer Tokens?

- **Stateless**: No server-side session storage needed
- **Scalable**: Works across multiple backend instances
- **Standard**: Industry-standard approach for APIs
- **CORS-friendly**: No cookie domain restrictions

### CSRF Protection

**Not needed** for Bearer token authentication because:

- Tokens are sent in headers, not cookies
- Browsers don't automatically attach Authorization headers
- Attacker cannot force the browser to send the token

### Token Storage

- **Frontend**: Tokens stored in memory (managed by Supabase)
- **Not in localStorage**: More secure against XSS
- **Automatic refresh**: Supabase handles token refresh automatically

## API Authentication

### Protected Endpoints

All endpoints under `/api/v1/*` require authentication:

```typescript
// Example: Make an authenticated request
const token = getToken(); // From Supabase session
const response = await fetch("http://localhost:8080/api/v1/sync/pull", {
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-kyar-device-id": deviceId,
    "x-kyar-client": "web",
  },
});
```

### Auth Verification Endpoint

Use `/api/v1/auth/me` to check authentication state:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8080/api/v1/auth/me
```

**Success (200):**

```json
{
  "authenticated": true,
  "userId": "uuid-here",
  "email": "user@example.com",
  "tier": "FREE"
}
```

**Failure (401):**

```json
{
  "code": "missing_auth_header",
  "message": "Authorization header is required. Please include 'Authorization: Bearer <token>' in your request."
}
```

## Error Codes

The backend returns structured error responses with specific codes:

| Code                  | Description                   | Solution                                       |
| --------------------- | ----------------------------- | ---------------------------------------------- |
| `missing_auth_header` | No Authorization header       | Include `Authorization: Bearer <token>` header |
| `invalid_auth_format` | Not using Bearer format       | Use `Bearer <token>` format                    |
| `missing_token`       | Token is empty                | Provide a valid JWT token                      |
| `expired_token`       | Token has expired             | Sign in again to get a new token               |
| `invalid_token`       | Token is malformed or invalid | Sign in again                                  |
| `invalid_claims`      | Token claims are invalid      | Sign in again                                  |
| `invalid_user_id`     | Missing user ID in token      | Sign in again                                  |

## Troubleshooting

### Problem: 401 Unauthorized

**Symptom:** API returns 401 on `/api/v1/sync/pull` or other protected endpoints.

**Diagnosis:**

1. Check if user is signed in on the frontend
2. Check browser console for auth debug messages
3. Verify token is being sent in Authorization header
4. Test with `/api/v1/auth/me` endpoint

**Common Causes & Solutions:**

#### 1. Wrong JWT_SECRET in backend

**Problem:** Backend JWT_SECRET doesn't match Supabase's JWT secret.

**Solution:**

```bash
# Get the correct JWT secret from Supabase:
# Dashboard → Project Settings → API → JWT Secret (click Reveal)

# Update your .env file:
JWT_SECRET=the-actual-jwt-secret-not-anon-key
```

**How to verify:**

- Anon key starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...`
- JWT secret is a long random string like `super-secret-jwt-token-with-at-least-32-characters`

#### 2. Missing environment variables in Docker

**Problem:** Backend logs "FATAL: Missing required environment variables".

**Solution:**

```bash
# Ensure .env exists in project root
# Restart backend container
docker-compose restart backend

# Check logs
docker-compose logs backend
```

#### 3. Token expired

**Problem:** Token is older than 1 hour (Supabase default).

**Solution:**

- Supabase automatically refreshes tokens
- Sign out and sign in again if issues persist

#### 4. User not signed in

**Problem:** Frontend doesn't have a token.

**Solution:**

- Check if user is on the sign-in page
- Verify Supabase credentials in `web/.env.local`
- Check browser console for Supabase warnings

### Problem: CORS Errors

**Symptom:** Browser console shows CORS policy errors.

**Diagnosis:**

```bash
# Check backend CORS configuration
docker-compose logs backend | grep CORS
```

**Solution:**

```bash
# Add your frontend origin to CORS_ORIGINS in .env
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://your-frontend-url
```

### Problem: Backend Won't Start

**Symptom:** Backend exits immediately with environment variable error.

**Solution:**

```bash
# Check which variables are missing
docker-compose logs backend

# Ensure these are set in .env:
# - JWT_SECRET
# - DATABASE_URL
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY

# Verify .env is in the project root (not backend/)
ls -la .env

# Restart
docker-compose up backend
```

## Testing

### Manual QA Checklist

- [ ] Backend starts successfully with all env vars
- [ ] Backend exits with clear error if JWT_SECRET is missing
- [ ] Frontend can sign up (email confirmation if enabled)
- [ ] Frontend can sign in
- [ ] Frontend stores and sends token correctly
- [ ] `/api/v1/auth/me` returns user info when authenticated
- [ ] `/api/v1/auth/me` returns 401 when not authenticated
- [ ] `/api/v1/sync/pull` works for PREMIUM_BASIC+ users
- [ ] `/api/v1/sync/pull` returns 403 for FREE users (tier restriction)
- [ ] CORS allows localhost origins
- [ ] Auth errors return structured JSON with helpful messages
- [ ] Token refresh works automatically
- [ ] Sign out clears token and redirects appropriately

### Automated Test Script

Run the auth test script:

```bash
# From backend directory
bash test_auth.sh
```

Or manually test with curl:

```bash
# 1. Health check (no auth)
curl http://localhost:8080/health

# 2. Test without token (expect 401)
curl -v http://localhost:8080/api/v1/auth/me

# 3. Test with token (get token from browser after signing in)
TOKEN="your-token-here"
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/auth/me

# 4. Test sync endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/sync/pull
```

## Development Tips

### Getting a Test Token

1. Sign in to the web app (http://localhost:3000)
2. Open browser DevTools → Console
3. Run:
   ```javascript
   // Get current token
   const { data } = await window.supabase.auth.getSession();
   console.log(data.session.access_token);
   ```
4. Copy the token for testing with curl/Postman

### Debug Auth State

In the browser console:

```javascript
// Import from web/src/lib/auth/client.ts
import { getAuthDebugInfo } from "@/lib/auth/client";

// Get debug info
const debug = getAuthDebugInfo();
console.log(debug);
// {
//   hasToken: true,
//   tokenPayload: { sub: "uuid", email: "user@example.com", ... },
//   tokenExpiry: Date("2024-...")
// }
```

### Backend Auth Logs

Auth failures are logged with sanitized info:

```
2024/01/15 10:30:45 Auth failed: Missing Authorization header from 192.168.1.5
2024/01/15 10:30:50 Auth failed: Expired token from 192.168.1.5
```

Check logs:

```bash
docker-compose logs -f backend | grep "Auth failed"
```

## Production Deployment

### Required Changes

1. **Update CORS_ORIGINS** to production domains:

   ```bash
   CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com
   ```

2. **Use production Supabase project**:
   - Create a production project in Supabase
   - Update all Supabase environment variables
   - Enable email confirmations in Supabase settings

3. **Secure environment variables**:
   - Use secret management (GCP Secret Manager, AWS Secrets Manager, etc.)
   - Never commit `.env` to version control
   - Rotate JWT_SECRET if compromised

4. **Enable HTTPS**:
   - Required for production
   - Configure TLS/SSL certificates
   - Update APP_URL to use `https://`

### Security Checklist

- [ ] All environment variables stored securely
- [ ] CORS_ORIGINS restricted to production domains
- [ ] HTTPS enabled on all services
- [ ] Supabase email confirmation enabled
- [ ] Database uses strong password
- [ ] Service role key kept secret
- [ ] Regular security audits

## Additional Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [JWT.io](https://jwt.io) - Decode and inspect JWTs
- [Fiber CORS Middleware](https://docs.gofiber.io/api/middleware/cors)
- [Next.js Environment Variables](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)

## Support

If you encounter issues not covered here:

1. Check the troubleshooting section above
2. Review backend logs: `docker-compose logs backend`
3. Check browser console for frontend errors
4. Test with `/api/v1/auth/me` endpoint
5. Verify environment variables are set correctly
