# Kyarafit

A mobile-first cosplay wardrobe and outfit planning app for cosplayers, fashion hobbyists, and content creators.

## Overview

Kyarafit helps cosplayers manage complex wardrobes, track build progress, plan conventions, and generate packing lists automatically. The app uses a funnel-based architecture where users progress from inventory management through outfit organization to event planning.

## Core Features

- **Closet Management**: Organize costume pieces with photos
- **Build Tracking**: Create cosplay builds and link closet items
- **Progress Planning**: Track build progress with customizable checklists
- **Convention Planning**: Schedule builds for specific convention days
- **Smart Packing Lists**: Auto-generate packing lists from convention schedules
- **Offline Support**: Mobile app works fully offline (local SQLite); syncs to cloud when signed in

## Architecture

- **Backend**: [Convex](https://convex.dev) — database, real-time queries, mutations, file storage
- **Auth**: [Better Auth](https://better-auth.com) — Google OAuth (GitHub optional), running as a Convex component
- **Web**: Next.js 15 (App Router) with TailwindCSS
- **Mobile**: React Native with Expo, local SQLite for offline-first storage
- **Image Service**: Python service for background removal (optional)
- **Design System**: Shared TypeScript types and tokens

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- A [Convex](https://dashboard.convex.dev) account
- Google OAuth credentials (from [Google Cloud Console](https://console.cloud.google.com))

### Development Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/kyarafit.git
   cd kyarafit
   npm install
   ```

2. **Initialize Convex**

   ```bash
   npx convex dev
   # Follow prompts to create/link a project
   # This writes CONVEX_DEPLOYMENT + CONVEX_URL + CONVEX_SITE_URL to .env.local
   ```

3. **Configure web environment** (`web/.env.local`)

   ```
   CONVEX_DEPLOYMENT=dev:your-deployment
   CONVEX_URL=https://your-deployment.convex.cloud
   CONVEX_SITE_URL=https://your-deployment.convex.site
   NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
   NEXT_PUBLIC_CONVEX_SITE_URL=https://your-deployment.convex.site
   ```

4. **Set Convex environment variables** (in Convex dashboard → Settings → Environment Variables)

   ```
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
   ```

   GitHub OAuth (optional):

   ```
   GITHUB_CLIENT_ID=your-github-client-id
   GITHUB_CLIENT_SECRET=your-github-client-secret
   ```

5. **Start development**

   ```bash
   # Terminal 1: Convex dev server (keeps functions in sync)
   npx convex dev

   # Terminal 2: Web app
   npm run dev:web

   # Terminal 3: Mobile (optional)
   npm run start -w mobile
   ```

   Or use the startup script:

   ```powershell
   .\scripts\start.ps1        # Windows
   bash scripts/start.sh      # Mac/Linux
   ```

6. **Access the app**
   - Web: http://localhost:3000
   - Mobile: Scan QR code with Expo Go

## Project Structure

```
kyarafit/
├── convex/                   # Convex backend (database, queries, mutations)
│   ├── schema.ts             # Database schema (all tables)
│   ├── closetItems.ts        # Closet CRUD
│   ├── builds.ts             # Builds CRUD
│   ├── buildTasks.ts         # Build task checklist
│   ├── conventions.ts        # Conventions + planning + packing
│   ├── users.ts              # User profiles
│   ├── files.ts              # File storage helpers
│   ├── auth.ts               # Auth identity query
│   └── betterAuth/           # Better Auth Convex component
├── web/                      # Next.js web application
│   ├── src/app/              # App routes
│   ├── src/components/       # React components
│   └── src/lib/auth/         # Better Auth client/server helpers
├── mobile/                   # React Native mobile app (Expo)
│   ├── app/                  # Expo Router screens
│   └── src/                  # Storage, auth, components
├── image-service/            # Python background removal service (optional)
├── design-system/            # Shared TypeScript types and design tokens
├── backend-archived/         # Archived Go Fiber backend (no longer used)
└── docs/                     # Documentation
```

## Development Scripts

```bash
# Run all CI checks locally (do this before pushing)
make validate
# or: npm run validate

# Start all services
make dev

# Individual services
make dev-web       # Next.js dev server
make dev-mobile    # Expo dev server
make dev-convex    # Convex dev server

# Code quality
make format        # Auto-format all code
make lint          # Lint all code
make typecheck     # Type check TypeScript
make test          # Run all tests
```

## Feature Flow

### 1. Closet Items (Foundation)

- Add costume pieces with photos
- Categorize by type (wig, prop, armor, garment, etc.)
- Track costs and add notes

### 2. Builds (Organization)

- Create cosplay builds for characters
- Link closet items to builds
- Track budget vs actual costs
- Add progress checklists (build tasks)
- Track status (idea → WIP → ready)

### 3. Conventions (Planning)

- Create conventions with dates and location
- Plan day-by-day: assign builds to specific dates
- Support rest days

### 4. Packing Lists (Automation)

- Auto-generate packing lists from convention schedules
- Smart deduplication (same item used multiple days appears once)
- Check off items as packed
- Add manual items (non-costume essentials)

## Key Technologies

- **Backend**: [Convex](https://convex.dev) (database, real-time, file storage)
- **Auth**: [Better Auth](https://better-auth.com) (Google/GitHub OAuth)
- **Web**: React, Next.js 15, TailwindCSS
- **Mobile**: React Native, Expo, SQLite (offline-first)
- **Image Processing**: Python, rembg (optional)
- **Design System**: Shared TypeScript types and tokens

## Testing & CI

```bash
# Run what CI runs (locally)
make validate

# Individual test suites
make test-web          # Web tests
make test-image-service # Python tests
```

Run `make validate` before pushing. See [CI_LOCAL.md](CI_LOCAL.md) for details.

## Deployment

- **Convex**: Auto-deploys via `npx convex deploy` or GitHub Actions
- **Web**: GCP Cloud Run (automated via GitHub Actions)
- **Image Service**: GCP Cloud Run (optional, automated via GitHub Actions)

See [docs/MIGRATION.md](docs/MIGRATION.md) for the Supabase → Convex migration summary.

## Documentation

### Getting Started

- [Migration Guide](docs/MIGRATION.md) - Supabase → Convex migration summary
- [Development Guide](docs/DEVELOPMENT.md) - Development environment setup
- **[CI/CD Local Guide](CI_LOCAL.md)** - Run CI checks locally before pushing

### Technical

- [Context Document](docs/CONTEXT.md) - Project context and architecture decisions
- [Auth Documentation](docs/auth.md) - Authentication flow
- [Project Structure](docs/project_structure.md) - Codebase organization

### Product & Design

- [Product Requirements (PRD)](docs/PRD.md) - Product vision and requirements
- [User Flows](docs/USER_FLOWS.md) - Comprehensive feature documentation
- [Design System](docs/design_system/README.md) - Component specifications
- [Style Guide](docs/style_doc.md) - UI/UX guidelines

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Image processing powered by [rembg](https://github.com/danielgatis/rembg)
- Authentication by [Better Auth](https://better-auth.com)
- Database and backend by [Convex](https://convex.dev)

---

**Built with ❤️ for the cosplay community**
