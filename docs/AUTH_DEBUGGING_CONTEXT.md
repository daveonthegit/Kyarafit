# Auth Debugging Context

**Date:** February 5, 2026  
**Status:** In Progress - Routing Issue Unresolved

## Original Problem

1. Backend (Go + Fiber) returns **401 Unauthorized** on `/api/v1/sync/pull`
2. Backend logs showed "No .env file found"
3. Goal: Fix auth end-to-end and improve it

## What Was Fixed

### Environment Configuration
- Updated `docker-compose.yml` to use `env_file: - .env` for backend service
- Added environment variable validation in `main.go` with fail-fast for required vars
- Made CORS origins configurable via `CORS_ORIGINS` env var
- Fixed "No .env file found" message (now logs as Info, not Warning)

### Auth Middleware Improvements
- Added structured error responses with codes (e.g., `missing_auth_header`, `expired_token`)
- Added logging for auth failures (sanitized, no sensitive data)
- Added support for both HMAC (HS256) and ECDSA (ES256) JWT validation
- Added `parseECDSAPublicKey()` function with escaped newline handling for env vars

### Backend Startup Issue (FIXED)
- Backend was hanging on startup due to `emailClient.Verify()` calling `smtp.Dial()`
- **Fix:** Commented out SMTP verification on startup in `main.go`

## Current Issue: Routes Return 404

### Symptoms
- `/health` works ✓
- `/api/v1/sync/pull` returns 401 "Authentication required" ✓ (correct behavior)
- `/api/v1/me` returns 404 "Cannot GET /api/v1/me" ✗
- `/api/v1/auth/me` returns 404 ✗
- `/api/v1/pieces` returns 404 ✗
- All routes directly on the `api` group return 404

### What's Strange
The **subgroup** works (`api.Group("/sync", ...)`) but **direct routes** on the api group don't.

```go
// This WORKS - returns 401
syncGroup := api.Group("/sync", middleware.RequireCloudSync)
syncGroup.Get("/pull", syncPullHandler(syncRepo))

// This DOESN'T WORK - returns 404
api.Get("/me", func(c *fiber.Ctx) error { ... })
```

### What Was Tried

1. **Using `api.Group("", requireWeb)` subgroup** - 404
2. **Using `api.Group("/", requireWeb)` subgroup** - 404
3. **Using `api.Use(requireWeb)` middleware** - 404
4. **Using inline middleware `api.Get("/me", requireWeb, handler)`** - Not fully tested yet

### Current Code State (main.go lines ~237-280)

```go
// API routes (web editor: require at least FREE tier)
api := app.Group("/api/v1")
api.Use(requireWeb)

// These return 404:
api.Get("/auth/me", func(c *fiber.Ctx) error { ... })
api.Get("/me", func(c *fiber.Ctx) error { ... })
api.Get("/pieces", piecesHandler.GetPieces)

// This works (returns 401):
syncGroup := api.Group("/sync", middleware.RequireCloudSync)
syncGroup.Get("/pull", syncPullHandler(syncRepo))
```

## Theories to Investigate

1. **Fiber v2 Group + Use() quirk** - Maybe `Use()` interferes with route registration
2. **Middleware returning error prevents route matching** - The `requireWeb` middleware returns early with 401, maybe this affects route tree
3. **Route registration order matters** - Maybe routes need to be registered before `Use()`
4. **Conflicting routes** - There are device-scoped routes like `/builds` and `/conventions` registered on `app.Group("")` that might conflict

## Files Modified

- `backend/main.go` - Major changes to routing, env validation, SMTP skip
- `backend/middleware/auth.go` - ECDSA support, structured errors, logging
- `backend/middleware/tier.go` - No changes, but relevant for `RequireWebAccess`
- `docker-compose.yml` - Added env_file, updated environment section
- `.env.example` - Added CORS_ORIGINS, clarified JWT_SECRET

## Next Steps

1. **Try inline middleware** on each route instead of `api.Use()`:
   ```go
   api.Get("/me", requireWeb, handler)
   ```

2. **Check route registration order** - Register routes before calling `Use()`

3. **Debug Fiber routing** - Add logging to see what routes are actually registered:
   ```go
   for _, route := range app.GetRoutes() {
       log.Printf("Route: %s %s", route.Method, route.Path)
   }
   ```

4. **Check for route conflicts** - The device-scoped routes at `/builds`, `/conventions` might be shadowing `/api/v1/builds`, etc.

5. **Simplify and test** - Create a minimal test endpoint without middleware to verify basic routing works

## Environment Setup Notes

- Supabase Auth uses ES256 (ECDSA) JWT signing
- `JWT_PUBLIC_KEY` in `.env` needs escaped newlines (`\n` as `\\n`)
- Backend is in Docker, `.env` file is at project root
- SMTP is optional - backend starts without it

## Related Todos (from previous session)

- [ ] Create comprehensive `docs/auth.md` documentation
- [ ] Create `backend/test_auth.sh` script and manual QA checklist
- [ ] Run `make validate` and fix any issues
- [ ] Add runtime checks and debugging helpers to frontend auth
