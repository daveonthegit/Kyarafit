# Security Fixes Tracking

**Audit Date**: 2026-02-04  
**Status**: Critical issues fixed, HIGH priority pending

---

## ✅ FIXED - Critical Issues

### ✅ CRIT-1: JWT Secret Fallback (FIXED)

- **File**: `backend/main.go:64`
- **Fix**: Changed from default fallback to `log.Fatal()` if JWT_SECRET is missing
- **Status**: ✅ Complete
- **Commit**: Applied pre-push

### ✅ CRIT-2: Stripe Webhook Signature (MITIGATED)

- **File**: `backend/main.go:191-280`
- **Fix**: Endpoint commented out + added security TODOs and placeholder signature check
- **Status**: ⚠️ Disabled until proper implementation
- **Next Steps**:
  1. Add `github.com/stripe/stripe-go/v76` to go.mod
  2. Set `STRIPE_WEBHOOK_SECRET` environment variable
  3. Implement `webhook.ConstructEvent()` verification
  4. Re-enable endpoint after testing

### ✅ CRIT-3: SQL Injection in GetUpcomingBuilds (FIXED)

- **File**: `backend/database/builds.go:374`
- **Fix**: Replaced `fmt.Sprintf()` with parameterized query using PostgreSQL interval cast
- **Status**: ✅ Complete
- **Commit**: Applied pre-push

### ✅ CRIT-4: CORS Wildcard (FIXED)

- **File**: `web/next.config.js:18`
- **Fix**: Changed from `'*'` to `process.env.NEXT_PUBLIC_APP_URL` with localhost fallback
- **Bonus**: Added security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection)
- **Status**: ✅ Complete
- **Commit**: Applied pre-push

---

## 🔴 HIGH PRIORITY (Fix within 48h)

### ⏳ HIGH-1: Rate Limiting

- **Files**: `backend/main.go`
- **Action**: Add Fiber rate limiter middleware
- **Impact**: Prevents brute force and DoS attacks
- **Estimated Time**: 30 minutes

```go
import "github.com/gofiber/fiber/v2/middleware/limiter"

// Global rate limit
app.Use(limiter.New(limiter.Config{
    Max:        100,
    Expiration: 60 * time.Second,
}))
```

### ⏳ HIGH-2: Mobile Token Storage (AsyncStorage → SecureStore)

- **Files**: `mobile/src/lib/auth/client.ts`
- **Action**: Use expo-secure-store instead of AsyncStorage
- **Impact**: Prevents token theft on rooted devices
- **Estimated Time**: 15 minutes

### ⏳ HIGH-3: File Upload Validation

- **Files**: `backend/internal/storage/supabase.go`
- **Action**: Add size limits, content-type validation, magic byte checks
- **Impact**: Prevents malicious file uploads and DoS
- **Estimated Time**: 45 minutes

### ⏳ HIGH-4: Device ID Validation & Crypto

- **Files**: `web/src/lib/deviceId.ts`, `backend/internal/*/handler.go`
- **Action**: Use crypto.randomUUID() + add backend validation regex
- **Impact**: Prevents ID prediction and injection attacks
- **Estimated Time**: 20 minutes

### ⏳ HIGH-5: CSRF Origin Validation

- **Files**: `backend/main.go` (new middleware)
- **Action**: Add origin/referer checks for state-changing requests
- **Impact**: Prevents cross-site request forgery
- **Estimated Time**: 30 minutes

### ⏳ HIGH-6: Web Token Storage Improvement

- **Files**: `web/src/lib/auth/client.ts`
- **Action**: Remove module-level token variable, use Supabase session directly
- **Impact**: Reduces XSS token exposure risk
- **Estimated Time**: 15 minutes

---

## 🟡 MEDIUM PRIORITY (Fix within 1 week)

- [ ] Input length validation (name, notes, tags)
- [ ] Error message sanitization (hide internal details)
- [ ] HTTP timeout configuration
- [ ] Docker default password documentation
- [ ] Security event logging
- [ ] JSONB tags array size limits

---

## 🔵 LOW PRIORITY (Nice to have)

- [ ] Image service authentication (when rembg added)
- [ ] Content-Length limits
- [ ] Standard device ID header naming

---

## 📋 Pre-Push Checklist

- [x] CRIT-1: JWT secret fallback removed
- [x] CRIT-2: Stripe webhook disabled with TODOs
- [x] CRIT-3: SQL injection fixed
- [x] CRIT-4: CORS wildcard removed
- [x] Backend compiles successfully
- [ ] Run: `go test ./...` (if tests exist)
- [ ] Verify .env files not staged: `git status`
- [ ] Review diff: `git diff`
- [ ] Create GitHub issues for HIGH priority items
- [ ] Update README with security notes

---

## 🧪 Security Testing Commands

```powershell
# Verify backend builds
cd backend
go build -o main.exe ./cmd/api

# Test JWT secret enforcement (should fail to start)
$env:JWT_SECRET=""
.\main.exe
# Expected: FATAL error and exit

# Verify web builds
cd ../web
npm run build

# Verify mobile builds
cd ../mobile
npm run build  # or: npx expo export

# Dependency audit
cd ../backend
go list -m all | findstr -i "vuln"

cd ../web
npm audit --audit-level=high

cd ../mobile
npm audit --audit-level=high
```

---

## 📞 Security Contact

For security issues, please:

1. Do NOT open public GitHub issues
2. Email: [your-security-email@example.com]
3. Use responsible disclosure (90-day window)

---

## 🔗 References

- OWASP Top 10 2021: https://owasp.org/Top10/
- Go Security Checklist: https://github.com/securego/gosec
- Stripe Webhook Security: https://stripe.com/docs/webhooks/signatures
- JWT Best Practices: https://tools.ietf.org/html/rfc8725

---

**Last Updated**: 2026-02-04  
**Next Review**: 2026-02-11 (1 week)
