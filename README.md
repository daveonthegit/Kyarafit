# Kyarafit

A mobile-first cosplay wardrobe and outfit planning app for cosplayers, fashion hobbyists, and content creators.

## Overview

Kyarafit helps cosplayers manage complex wardrobes, track build progress, plan conventions, and generate packing lists automatically. The app uses a funnel-based architecture where users progress from inventory management through outfit organization to event planning.

## Core Features

- **Closet Management**: Organize costume pieces with automatic background removal
- **Build Tracking**: Create cosplay builds and link closet items
- **Progress Planning**: Track build progress with customizable checklists
- **Convention Planning**: Schedule builds for specific convention days
- **Smart Packing Lists**: Auto-generate packing lists from convention schedules
- **Offline Support**: Mobile app works fully offline with background sync

## Architecture

- **Backend**: Go API server with PostgreSQL database
- **Image Service**: Python service for background removal
- **Web**: Next.js with React and TailwindCSS
- **Mobile**: React Native with Expo
- **Storage**: Supabase for authentication and file storage
- **Design System**: Shared TypeScript types and tokens

## Documentation

### Getting Started
- [Quickstart Guide](QUICKSTART_SUPABASE.md) - Get up and running quickly
- [Development Guide](docs/DEVELOPMENT.md) - Development environment setup
- [Docker Setup](DOCKER_SETUP.md) - Docker-based development

### Product & Design
- [Product Requirements (PRD)](docs/PRD.md) - Product vision and requirements
- **[User Flows](docs/USER_FLOWS.md)** - Comprehensive implementation documentation
- [Design System](docs/design_system/README.md) - Component specifications and tokens
- [Style Guide](docs/style_doc.md) - UI/UX guidelines

### Technical
- [Architecture](docs/architecture.md) - System architecture overview
- [API Documentation](backend/API_DOCUMENTATION.md) - Backend API reference
- [Project Structure](docs/project_structure.md) - Codebase organization
- [Context Document](docs/CONTEXT.md) - Project context and decisions

### Setup Guides
- [Supabase Setup](SUPABASE_SETUP.md) - Authentication and storage configuration
- [Supabase Storage](SUPABASE_STORAGE_SETUP.md) - File storage setup
- [User Sync System](USER_SYNC_SYSTEM.md) - User info and subscription sync
- [SMTP Setup](SMTP_SETUP.md) - Email configuration
- [Auth Implementation](AUTH_IMPLEMENTATION.md) - Authentication flow

### Contributing
- [Contributing Guide](docs/CONTRIBUTING.md) - How to contribute
- [Code of Conduct](docs/CODE_OF_CONDUCT.md) - Community guidelines
- [Security Policy](docs/SECURITY.md) - Security practices
- [Roadmap](docs/roadmap.md) - Future plans

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Go 1.21+
- Python 3.11+
- Docker and Docker Compose (optional)
- Supabase account (for auth and storage)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/kyarafit.git
   cd kyarafit
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   cp backend/.env.example backend/.env
   cp web/.env.example web/.env
   ```

3. **Start with Docker Compose** (recommended)
   ```bash
   docker-compose up
   ```

   Or **start services manually**:
   
   ```bash
   # Backend
   cd backend
   go run main.go
   
   # Image Service
   cd image-service
   pip install -r requirements.txt
   python main.py
   
   # Web
   cd web
   npm install
   npm run dev
   
   # Mobile
   cd mobile
   npm install
   npm start
   ```

4. **Run migrations**
   ```bash
   cd backend
   make migrate-up
   ```

5. **Access the applications**
   - Web: http://localhost:3000
   - Backend API: http://localhost:8080
   - Image Service: http://localhost:5000
   - Mobile: Scan QR code with Expo Go app

## Project Structure

```
kyarafit/
├── backend/              # Go API server
│   ├── cmd/api/         # Application entry point
│   ├── internal/        # Internal packages
│   ├── migrations/      # Database migrations
│   └── middleware/      # HTTP middleware
├── image-service/       # Python background removal service
├── web/                 # Next.js web application
│   ├── src/app/        # App routes
│   ├── src/components/ # React components
│   └── src/lib/        # Utilities and API clients
├── mobile/             # React Native mobile app
│   ├── app/           # App screens
│   └── src/           # Components and utilities
├── design-system/     # Shared types and design tokens
│   └── types/        # TypeScript type definitions
└── docs/             # Documentation
```

## Feature Flow

### 1. Closet Items (Foundation)
- Add costume pieces with photos
- Automatic background removal
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
- Add notes per day (e.g., photoshoot times)
- Support rest days

### 4. Packing Lists (Automation)
- Auto-generate packing lists from convention schedules
- Smart deduplication (same item used multiple days appears once)
- Check off items as packed
- Add manual items (non-costume essentials)
- Preserved checked state across regenerations

## User Journey Example

1. **Week 1-3**: Add costume pieces to closet as acquired
2. **Week 4**: Create builds (e.g., "Sailor Moon", "Zelda") and link items
3. **Week 4**: Add build tasks to track progress
4. **Week 5**: Create convention and plan which build for each day
5. **Week 6**: Generate packing list - all items automatically collected
6. **Pre-convention**: Check off items as packed
7. **Convention**: Access schedule and packing list offline on mobile

## Key Technologies

- **Backend**: Go, Fiber, PostgreSQL, golang-migrate
- **Frontend**: React, Next.js, TailwindCSS, TanStack Query
- **Mobile**: React Native, Expo, SQLite
- **Auth**: Supabase Auth with JWT
- **Storage**: Supabase Storage
- **Image Processing**: Python, rembg, Flask
- **DevOps**: Docker, GitHub Actions, Fly.io

## Development Scripts

```bash
# Start all services
npm run dev              # Development mode
npm run start           # Production mode

# Backend
cd backend
go run main.go          # Run server
make migrate-up         # Run migrations
make migrate-down       # Rollback migrations
go test ./...          # Run tests

# Web
cd web
npm run dev            # Development server
npm run build          # Production build
npm run lint           # Lint code

# Mobile
cd mobile
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
```

## Testing

```bash
# Backend
cd backend
go test ./...

# Web
cd web
npm run test

# Mobile
cd mobile
npm run test
```

## Deployment

- **Backend**: Deploy to Fly.io or Render
- **Web**: Deploy to Vercel or Fly.io
- **Image Service**: Deploy to Fly.io
- **Database**: Supabase PostgreSQL

See [deployment documentation](deploy/README.md) for detailed instructions.

## Contributing

We welcome contributions! Please see our [Contributing Guide](docs/CONTRIBUTING.md) for details on:
- Code of conduct
- Development workflow
- Pull request process
- Coding standards

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **Documentation**: Check the [docs](docs/) folder
- **Issues**: Report bugs via [GitHub Issues](https://github.com/yourusername/kyarafit/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/yourusername/kyarafit/discussions)

## Acknowledgments

- Image processing powered by [rembg](https://github.com/danielgatis/rembg)
- Authentication by [Supabase](https://supabase.com)
- Icons from [React Native Vector Icons](https://github.com/oblador/react-native-vector-icons)

---

**Built with ❤️ for the cosplay community**
