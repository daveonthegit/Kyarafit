# Kyarafit Documentation

This directory contains all project documentation organized by category.

## 📁 Directory Structure

### `/setup`
Setup and configuration guides for getting the project running.

- `DOCKER_SETUP.md` - Docker configuration and setup
- `QUICKSTART_SUPABASE.md` - Quick start guide for Supabase
- `SUPABASE_SETUP.md` - Detailed Supabase setup guide
- `SUPABASE_STORAGE_SETUP.md` - Supabase Storage configuration
- `SUPABASE_DEV_CONFIG.md` - Development configuration for Supabase
- `DEPLOY_README.md` - Deployment instructions and guides

### `/integrations`
Documentation for third-party service integrations.

- `SMTP_SETUP.md` - SMTP email service setup
- `SMTP_QUICKSTART.md` - Quick start guide for SMTP
- `SMTP_IMPLEMENTATION_SUMMARY.md` - Detailed SMTP implementation details
- `RESEND_SETUP.md` - Resend email service setup
- `AUTH_IMPLEMENTATION.md` - Authentication implementation details

### `/implementation`
Implementation status, TODOs, and system design documents.

- `IMPLEMENTATION_STATUS.md` - Current implementation status and progress
- `NEXT_STEPS.md` - Upcoming tasks and next steps
- `USER_SYNC_SYSTEM.md` - User synchronization system design
- `USER_SYNC_QUICK_REF.md` - Quick reference for user sync
- `SUPABASE_TODO.md` - Supabase-related tasks and TODOs

### `/api`
API documentation and references.

- `API_DOCUMENTATION.md` - Backend API documentation
- `api_overview.md` - API overview and architecture

### `/changelog`
Change logs, fixes, and version history.

- `CHANGELOG_USER_SYNC.md` - User sync feature changelog
- `CRITICAL_FIXES_APPLIED.md` - Critical bug fixes log
- `SECURITY_FIXES.md` - Security-related fixes and updates

### `/design_system`
Design system documentation and specifications.

- `component_spec.md` - Component specifications
- `design_lint.md` - Design linting rules
- `design_tokens.json` - Design tokens definition
- `README.md` - Design system overview
- `README_main.md` - Main design system guide
- `rn_tokens.ts` - React Native design tokens
- `tailwind.config.js` - Tailwind configuration

## 📚 Core Documentation (Root Level)

The following documentation remains at the root `/docs` level:

- `architecture.md` - System architecture overview
- `CONTEXT.md` - Project context and background
- `CONTRIBUTING.md` - Contribution guidelines
- `CODE_OF_CONDUCT.md` - Code of conduct
- `DEVELOPMENT.md` - Development setup and guidelines
- `LICENSE.md` - Project license
- `PRD.md` - Product Requirements Document
- `project_structure.md` - Project structure overview
- `roadmap.md` - Product roadmap
- `SECURITY.md` - Security policies and reporting
- `style_doc.md` - Code style guide
- `USER_FLOWS.md` - User flow documentation

## 🔍 Finding Documentation

### For Developers
- **Getting Started**: Start with `/setup/QUICKSTART_SUPABASE.md`
- **Development**: Read `DEVELOPMENT.md` and `CONTRIBUTING.md`
- **API Reference**: Check `/api/API_DOCUMENTATION.md`
- **Architecture**: See `architecture.md` and `project_structure.md`

### For Integrators
- **Email Setup**: See `/integrations/SMTP_QUICKSTART.md` or `/integrations/RESEND_SETUP.md`
- **Authentication**: Check `/integrations/AUTH_IMPLEMENTATION.md`
- **Storage**: See `/setup/SUPABASE_STORAGE_SETUP.md`

### For Contributors
- **Contributing**: Read `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`
- **Style Guide**: See `style_doc.md` and `/design_system/`
- **Current Status**: Check `/implementation/IMPLEMENTATION_STATUS.md`

### For Project Managers
- **Product Specs**: See `PRD.md` and `USER_FLOWS.md`
- **Roadmap**: Check `roadmap.md`
- **Progress**: See `/implementation/IMPLEMENTATION_STATUS.md` and `/implementation/NEXT_STEPS.md`

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

All documentation has been reorganized into topical folders for better discoverability and maintainability. Previous root-level documentation files have been moved to appropriate subdirectories.

---

**Last Updated**: February 4, 2026
