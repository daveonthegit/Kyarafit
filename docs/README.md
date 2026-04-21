# Kyarafit Documentation

This directory contains all project documentation organized by category.

## 📁 Directory Structure

### `/setup`

Setup and configuration guides for getting the project running. **Active stack:** Convex + Better Auth (see [project README](../README.md) and [MIGRATION.md](MIGRATION.md)). Supabase setup docs were removed (migrated to Convex).

- `DOCKER_SETUP.md` - Docker configuration and setup
- `DEPLOY_README.md` - Deployment instructions and guides
- `DEPLOYMENT_CHECKLIST.md` - Deployment checklist
- `GCP_DEPLOYMENT_README.md` - GCP deployment
- `GCP_SETUP_SUMMARY.md` - GCP setup summary

### `/integrations`

Documentation for third-party service integrations. **Auth:** See [auth.md](auth.md) for Better Auth (current). Legacy Supabase auth doc removed.

- `SMTP_SETUP.md` - SMTP email service setup
- `SMTP_QUICKSTART.md` - Quick start guide for SMTP
- `SMTP_IMPLEMENTATION_SUMMARY.md` - Detailed SMTP implementation details
- `RESEND_SETUP.md` - Resend email service setup (e.g. Better Auth verification/reset)

### `/implementation`

Implementation planning, status, and step-by-step guides. **Start here:** [implementation/README.md](implementation/README.md) (stack summary, where to start, link to rules).

**Core planning docs:**

- `README.md` - Entry point; stack summary; what changed; where to start
- `FEATURES_CANONICAL.md` - Canonical feature list and acceptance criteria
- `FEATURE_STATUS.md` - Implemented vs partial vs not implemented (with evidence)
- `GAP_ANALYSIS.md` - Remaining work by area
- `ROADMAP.md` - Phased implementation roadmap (Phase 0–4)
- `COMMIT_PLAN.md` - PR-sized commit plan with verification checklists
- `DOC_INVENTORY.md` - Inventory and classification of implementation docs
- `IMPLEMENTATION_STATUS.md` - Current completed vs remaining (Convex + Better Auth)
- `NEXT_STEPS.md` - Post-migration priorities
- `IMPLEMENTATION_GUIDES_INDEX.md` - Index of step-by-step implementation guides
- `DOCS_AND_SETUP_UPDATES.md` - Keep docs aligned with Convex + Better Auth

Obsolete docs (web sync, Supabase TODO, user sync system, AUTH_WEB) were removed in the March 2026 audit; see `DOC_INVENTORY.md`.

### `/competitor`

Product research and competitor-informed implementation planning.

- [COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md](competitor/COMPETITOR_ANALYSIS_AND_IMPLEMENTATION_PLAN.md) - Cosplanner screenshot analysis, feature comparison vs Kyarafit, gap prioritization (Tier 1–3), implementation design (e.g. elements ≈ closet items), phased roadmap, and engineering task list. Linked from implementation docs for competitor-parity work.

### `/api`

API documentation and references. **Current:** Convex (queries/mutations). **Legacy:** Go REST API doc kept for reference only.

- `api_overview.md` - **Convex** API overview (start here)
- `API_DOCUMENTATION.md` - Legacy Go Fiber REST API (reference only; not used by app)

### `/changelog`

Change logs, fixes, and version history.

- `CHANGELOG_USER_SYNC.md` - User sync feature changelog
- `CRITICAL_FIXES_APPLIED.md` - Critical bug fixes log
- `SECURITY_FIXES.md` - Security-related fixes and updates

### `/design_system`

Design system documentation and specifications. **North star + rollout:** [design/PRODUCT_REDESIGN_PLAN.md](design/PRODUCT_REDESIGN_PLAN.md). **Web runtime:** `web/src/app/globals.css` (OKLCH `--kyar-*`).

- `component_spec.md` - Component specifications
- `design_lint.md` - Design linting rules
- `EDITORIAL_GUIDELINES.md` - Editorial patterns and typography
- `design_tokens.json` - Design tokens definition (v0.2+; light + dark)
- `README.md` - Design system overview
- `README_main.md` - Main design system guide
- `rn_tokens.ts` - React Native design tokens
- `tailwind.config.js` - Tailwind configuration (repo root `web/tailwind.config.js` for the app)

## 📚 Core Documentation (Root Level)

The following documentation remains at the root `/docs` level:

- `architecture.md` - System architecture overview (Convex + Better Auth)
- `auth.md` - **Better Auth** setup, CORS, trusted origins, troubleshooting
- `CONTEXT.md` - Project context, tech stack, data model, Convex function reference
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Code of conduct
- `DEVELOPMENT.md` - Development workflow and guidelines
- `LICENSE.md` - Project license
- `MIGRATION.md` - Supabase/Go → Convex migration summary
- `PRD.md` - Product Requirements Document
- `project_structure.md` - Project structure overview
- `roadmap.md` - Product roadmap (high-level)
- `SECURITY.md` - Security policies and reporting
- `style_doc.md` - Visual & interaction style (tokens, typography, themes)
- `design/PRODUCT_REDESIGN_PLAN.md` - Product redesign north star, phases, and progress tracker
- `USER_FLOWS.md` - User flows (redirects to current feature/flows docs)
- `WEB_MOBILE_PARITY_REVIEW.md` - Web vs mobile feature parity (Convex-era)
- `GCP_QUICKSTART.md` - GCP quick start
- `GCP_DEPLOYMENT.md` - GCP deployment

## 🔍 Finding Documentation

### For Developers

- **Getting Started**: Start with the [project README](../README.md) (Convex + Better Auth setup).
- **Development**: Read `DEVELOPMENT.md` and `CONTRIBUTING.md`
- **API Reference**: Convex — see [api/api_overview.md](api/api_overview.md) and `CONTEXT.md`. Legacy Go: [api/API_DOCUMENTATION.md](api/API_DOCUMENTATION.md) (reference only).
- **Auth**: See [auth.md](auth.md) for Better Auth (CORS, trusted origins, troubleshooting).
- **Architecture**: See `architecture.md` and `project_structure.md`
- **Migration**: See `MIGRATION.md` for Supabase/Go → Convex summary.

### For Integrators

- **Email Setup**: See `/integrations/SMTP_QUICKSTART.md` or `/integrations/RESEND_SETUP.md` (e.g. for Better Auth verification/reset).
- **Authentication**: Better Auth — see [auth.md](auth.md).
- **Storage**: Convex file storage (see `convex/files.ts`).

### For Contributors

- **Contributing**: Read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
- **Style Guide**: See `style_doc.md`, `design/PRODUCT_REDESIGN_PLAN.md`, and `/design_system/`
- **Patterns and rules**: See **[rules/](../rules/)** at repo root (backend, frontend, testing, CI/CD, security, commit/PR guidelines)
- **Current Status**: Start at [implementation/README.md](implementation/README.md); then `FEATURE_STATUS.md`, `GAP_ANALYSIS.md`, `IMPLEMENTATION_STATUS.md`

### For Project Managers

- **Product Specs**: See `PRD.md` and `USER_FLOWS.md`
- **Product Roadmap**: See `roadmap.md` (high-level phases)
- **Implementation Roadmap**: See [implementation/ROADMAP.md](implementation/ROADMAP.md) (phased execution plan) and [implementation/COMMIT_PLAN.md](implementation/COMMIT_PLAN.md) (PR-sized breakdown)
- **Progress**: See `implementation/FEATURE_STATUS.md` and `implementation/IMPLEMENTATION_STATUS.md`

## 📝 Documentation Standards

When adding new documentation:

1. **Setup/Config Docs** → `/setup/`
2. **Third-party Integrations** → `/integrations/`
3. **Implementation Details** → `/implementation/`
4. **API References** → `/api/`
5. **Change Logs** → `/changelog/`
6. **Design Specs** → `/design_system/`
7. **General/Core Docs** → Root `/docs/`

## 🔄 Recent Changes

- **March 2026 – Docs review:** Deprecated docs removed: Supabase setup (QUICKSTART*SUPABASE, SUPABASE_SETUP, SUPABASE_STORAGE_SETUP, SUPABASE_DEV_CONFIG), legacy auth (integrations/AUTH_IMPLEMENTATION), one-off prompts (SONNET*\*), and Go-era debug (AUTH_DEBUGGING_CONTEXT). Root docs (README, CONTEXT, DEVELOPMENT, USER_FLOWS) updated for Convex and `npm run validate`. Setup and integrations sections in this README updated to match.
- **March 2026 – Implementation audit:** Implementation folder updated with FEATURES_CANONICAL, FEATURE_STATUS, GAP_ANALYSIS, ROADMAP, COMMIT_PLAN; obsolete implementation docs removed; guides rewritten for Convex. **Rules** at repo root (`rules/`). See [implementation/README.md](implementation/README.md).

---

**Last Updated**: March 4, 2026
