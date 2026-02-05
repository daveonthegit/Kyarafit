# golangci-lint Errors - Fix Guide

**Status**: CI failing due to new `.golangci.yml` linter configuration  
**Priority**: Fix before merging CI/CD improvements

---

## 📊 Error Summary

The newly added `.golangci.yml` caught **50+ linting issues**. Most are **non-critical** stylistic improvements, but some should be fixed.

### Error Categories

| Category                     | Count | Severity | Action                  |
| ---------------------------- | ----- | -------- | ----------------------- |
| **dupl** (duplicate code)    | 16    | Medium   | Refactor (low priority) |
| **gocritic** (style)         | 15    | Low      | Fix selectively         |
| **govet** (shadow variables) | 8     | Medium   | Fix                     |
| **misspell** (spelling)      | 4     | Low      | Fix (easy)              |
| **gocyclo** (complexity)     | 6     | Low      | Ignore for now          |
| **gosec** (security)         | 1     | **HIGH** | **Fix immediately**     |
| **goimports** (formatting)   | 3     | Low      | Fix                     |
| **goconst** (constants)      | 1     | Low      | Fix                     |

---

## 🔥 Critical - Must Fix

### 1. Security Issue (gosec)

**File**: `backend/internal/email/client.go:95`

```go
// ❌ CURRENT (insecure - no MinVersion set)
tlsConfig := &tls.Config{
    ServerName: c.Host,
}

// ✅ FIX (set minimum TLS version)
tlsConfig := &tls.Config{
    ServerName: c.Host,
    MinVersion: tls.VersionTLS12,  // Add this line
}
```

**Why**: Without MinVersion, TLS 1.0/1.1 (deprecated, insecure) could be used.

---

## ⚠️ High Priority - Should Fix

### 2. Import Formatting (goimports)

**Files**: `backend/models/build.go`, `backend/models/piece.go`, `backend/handlers/builds.go`

```go
// ❌ CURRENT
import (
    "github.com/google/uuid"
    "time"
)

// ✅ FIX (standard library first, then external)
import (
    "time"

    "github.com/google/uuid"
)
```

**Fix command**:

```bash
cd backend
goimports -w models/build.go models/piece.go handlers/builds.go
```

### 3. Spelling: "cancelled" → "canceled"

**File**: `backend/models/build.go`

American spelling is standard in Go. Change all instances:

- Line 17: `BuildStatusCancelled` → `BuildStatusCanceled`
- Line 47: validation string
- Line 63: validation string
- Line 132: return "Canceled"

**Note**: This is a breaking API change. Consider keeping as-is if API is already in use.

---

## 💡 Medium Priority - Recommended

### 4. Variable Shadowing (govet)

**Multiple files** have `err` shadowing:

```go
// ❌ SHADOWING
err := someFunc()  // outer err
if parsedLimit, err := strconv.Atoi(limitStr); err == nil {  // shadows outer err
    limit = parsedLimit
}

// ✅ FIX (use different variable name)
err := someFunc()
if parsedLimit, parseErr := strconv.Atoi(limitStr); parseErr == nil {
    limit = parsedLimit
}
```

**Files to fix**:

- `backend/handlers/builds.go` (lines 140, 146, 164)
- `backend/handlers/pieces.go` (lines 114, 120)
- `backend/internal/convention/repository.go` (line 252)
- `backend/internal/seed/seed.go` (line 53)
- `backend/internal/sync/sync.go` (lines 138, 165, 195)

### 5. Extract String Constant (goconst)

**File**: `backend/internal/builds/handler.go:64`

```go
// ❌ CURRENT (repeated 3 times)
if in.Status != "" && in.Status != "idea" && in.Status != "wip" && in.Status != "ready" {
    // ...
}

// ✅ FIX (use constants from models package)
if in.Status != "" && in.Status != string(models.BuildStatusIdea) &&
   in.Status != string(models.BuildStatusWIP) && in.Status != string(models.BuildStatusReady) {
    // ...
}
```

---

## 🔄 Low Priority - Refactor Later

### 6. Duplicate Code (dupl)

**16 instances** of duplicate database scanning logic. Example:

```go
// Duplicated 8 times in database/builds.go
for rows.Next() {
    build := &models.Build{}
    err := rows.Scan(
        &build.ID,
        &build.UserID,
        // ... 15 more fields
    )
    if err != nil {
        return nil, fmt.Errorf("failed to scan build: %w", err)
    }
    builds = append(builds, build)
}
```

**Solution**: Extract to helper function:

```go
func scanBuilds(rows pgx.Rows) ([]*models.Build, error) {
    var builds []*models.Build
    for rows.Next() {
        build := &models.Build{}
        err := rows.Scan(/* all fields */)
        if err != nil {
            return nil, fmt.Errorf("failed to scan build: %w", err)
        }
        builds = append(builds, build)
    }
    return builds, nil
}
```

**Why low priority**: Works correctly, just not DRY. Can refactor later.

### 7. High Cyclomatic Complexity (gocyclo)

**6 functions** exceed complexity threshold (>15):

- `backend/handlers/builds.go:252` - UpdateBuild (complexity: 28)
- `backend/handlers/builds.go:116` - GetBuilds (complexity: 23)
- `backend/internal/sync/sync.go:106` - Pull (complexity: 20)
- `backend/handlers/pieces.go:207` - UpdatePiece (complexity: 19)
- `backend/internal/convention/repository.go:221` - RegeneratePackingList (complexity: 19)
- `backend/internal/builds/handler.go:49` - Create (complexity: 17)

**Why low priority**: Complex business logic. Breaking these up might reduce readability. Acceptable tradeoff.

### 8. gocritic Style Issues

**15 instances** of style suggestions:

- `paramTypeCombine`: Group same-type parameters
- `ifElseChain`: Convert if-else to switch
- `hugeParam`: Pass large structs by pointer
- `sloppyReassign`: Use `:=` instead of reassignment
- `httpNoBody`: Use `http.NoBody` instead of `nil`
- `rangeValCopy`: Use pointers in range loops
- `commentedOutCode`: Remove commented code
- `exitAfterDefer`: `log.Fatal` prevents defer execution

**Impact**: Minor performance/readability. Not critical.

---

## 🚫 Configuration Issues (Warnings)

The following config warnings appeared:

```
level=warning msg="[config_reader] The configuration option `run.skip-files` is deprecated, please use `issues.exclude-files`."
level=warning msg="[config_reader] The configuration option `run.skip-dirs` is deprecated, please use `issues.exclude-dirs`."
level=warning msg="[config_reader] The configuration option `output.format` is deprecated, please use `output.formats`"
level=warning msg="[config_reader] The configuration option `linters.govet.check-shadowing` is deprecated. Please enable `shadow` instead."
level=error msg="[linters_context] exportloopref: This linter is fully inactivated since Go1.22."
```

**Fix**: Update `.golangci.yml` to use new config options.

---

## 🎯 Recommended Action Plan

### Option 1: Quick Fix (Minimal) ✅ **RECOMMENDED**

Fix only critical/high-priority issues:

1. **Security**: Add TLS MinVersion (1 line)
2. **Imports**: Run `goimports` (automated)
3. **Spelling**: Keep "cancelled" (avoid breaking API)
4. **Disable dupl/gocyclo**: Add to `.golangci.yml` exclusions

**Time**: 5 minutes  
**Risk**: Low

### Option 2: Comprehensive Fix

Fix all issues:

1. Security + imports + spelling
2. Fix all variable shadowing
3. Extract duplicate code
4. Refactor high-complexity functions
5. Apply all gocritic suggestions

**Time**: 2-4 hours  
**Risk**: Medium (could introduce bugs)

### Option 3: Relax Linter (Quickest) ⚡

Temporarily disable strict checks:

Update `.golangci.yml`:

```yaml
linters:
  disable:
    - dupl # Too many false positives
    - gocyclo # Business logic is inherently complex
    - gocritic # Style preferences, not errors
```

**Time**: 1 minute  
**Risk**: None (just less strict checking)

---

## 📝 Suggested Immediate Fix

Here's the minimal fix to unblock CI:

### 1. Fix Security Issue

```bash
# Edit backend/internal/email/client.go line 95-97
# Add MinVersion: tls.VersionTLS12
```

### 2. Fix Imports

```bash
cd backend
go install golang.org/x/tools/cmd/goimports@latest
goimports -w models/ handlers/
```

### 3. Update .golangci.yml

Add exclusions for low-priority checks:

```yaml
issues:
  exclude-rules:
    - path: _test\.go
      linters:
        - dupl
        - gosec
    - path: migrations/
      linters:
        - gosec
    # NEW: Exclude dupl for database files (too much scanning boilerplate)
    - path: database/
      linters:
        - dupl
    # NEW: Exclude gocyclo for handlers (complex business logic)
    - path: handlers/
      linters:
        - gocyclo

linters:
  disable-all: true
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - typecheck
    - unused
    - gosec # Keep security checks
    - goimports # Keep import formatting
    - misspell # Keep spelling checks
    # Disable noisy linters:
    # - dupl       # Too many database scanning patterns
    # - gocyclo    # Business logic is complex
    # - gocritic   # Too opinionated
```

---

## ✅ After Fix

Run locally:

```bash
cd backend
golangci-lint run
```

Should see:

- ✅ No security errors
- ✅ No import formatting errors
- ⚠️ Maybe some style warnings (acceptable)

---

## 💬 Recommendation

**Use Option 1 + Update Config**: Fix critical security issue, run goimports, and relax linter for noisy checks.

**Why**: Balances code quality with pragmatism. The duplicate code and complexity issues are real but not urgent. They can be addressed in a dedicated refactoring PR later.

---

**Next Steps**:

1. Review this guide
2. Choose an option (recommend Option 1)
3. Apply fixes
4. Test CI
5. Merge CI/CD improvements
6. Create follow-up issue for refactoring (optional)
