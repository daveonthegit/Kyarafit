# PR: feat(web) — Build project notes dedicated (Feature 15)

**Branch:** `feat/build-notes-dedicated`  
**Create PR:** https://github.com/daveonthegit/Kyarafit/compare/feat/build-notes-dedicated

---

## Description

Implements **Feature 15 — Build project notes dedicated** from FEATURES_CANONICAL. Adds a dedicated Notes entry point on build detail: button opens a modal to view, edit, save, and clear build notes. Content persists via existing `build.notes` and `api.builds.update(notes)` (no schema changes).

## Type of Change

- [x] New feature (non-breaking change which adds functionality)

## Service(s) Affected

- [x] Web app
- [ ] Mobile app
- [ ] Backend API
- [ ] Documentation
- [x] CI/CD (docs only)

## Testing

- [x] Unit tests pass: `BuildNotesModal.test.tsx` (11 tests)
- [x] `npm run validate` passes (format, lint, typecheck, build)
- [x] Manual: open build detail → Notes (description icon) → edit/save/clear

## Checklist

- [x] My code follows the project's style guidelines
- [x] I have performed a self-review of my own code
- [x] I have made corresponding changes to the documentation
- [x] My changes generate no new warnings
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes

## Summary of changes

- **New:** `web/src/components/builds/BuildNotesModal.tsx` — presentational modal (open, notes, onSave, onClear, onClose, saving, error)
- **New:** `web/src/components/builds/BuildNotesModal.test.tsx` — unit tests for modal behavior
- **Updated:** `web/src/app/build-detail/page.tsx` — Notes button in header, state and handlers, `BuildNotesModal` wired to `api.builds.update` for notes
- **Docs:** FEATURE_STATUS (Feature 15 → Implemented), GAP_ANALYSIS (implemented note), COMMIT_PLAN (2.9 added)

## How to verify locally

1. `npm run validate`
2. `npm run test -w web`
3. Open a build detail → click Notes (description icon) → type, Save; reopen to confirm persistence; Clear notes to empty.

## Follow-ups

- Mobile: dedicated Notes screen/modal on build detail (Feature 15 mobile parity).
