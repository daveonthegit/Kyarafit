# Kyarafit

Kyarafit is a mobile-first cosplay wardrobe and outfit planning application.  
It helps cosplayers track builds, manage their closet, design character coords, and receive notifications about new drops and restocks from their favorite shops.

---

## Overview

Kyarafit is designed for cosplayers, fashion hobbyists, and content creators who need a single platform to:

- Organize and catalog costume pieces, props, and wigs.
- Plan and visualize character coords with a layered editor.
- Track build progress, budgets, and WIP status.
- Save product links and receive restock alerts.
- Generate convention packing lists and schedules.

---

## Features (MVP)

- **Closet Management** – Upload and auto-cutout costume pieces, wigs, and props.
- **Build Tracking** – Group items by character and track progress from idea to completion.
- **Coord Builder** – Drag-and-drop pieces into a layered canvas to plan outfits.
- **Wishlist and Alerts** – Add product URLs, monitor stock status, and get notified on restocks.
- **Convention Mode** – Create day-by-day cosplay plans and packing lists.
- **Offline Ready** – Access wardrobe and build data without internet connectivity.

---

## Tech Stack

- **Mobile:** React Native with Expo (TypeScript)
- **Web:** Next.js 14 with TypeScript and Tailwind CSS
- **Backend:** Go with Fiber framework, PostgreSQL with pgvector, Redis
- **Image Processing:** Python FastAPI with rembg for AI-powered background removal
- **Infrastructure:** Dockerized services, deployed to Fly.io or Render, Cloudflare Images for CDN

## Repository Structure

```
Kyarafit/
├── mobile/           # React Native + Expo app
├── web/             # Next.js web application
├── backend/         # Go API server
├── image-service/   # Python FastAPI image processing
├── docker-compose.yml
└── README.md
```

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Go 1.21+
- Python 3.11+
- Docker and Docker Compose
- Expo CLI (`npm install -g @expo/cli`)

### One-Command Setup

```bash
git clone <repository-url>
cd Kyarafit
./setup.sh
```

This script will:
- Check all requirements
- Install dependencies
- Setup environment files
- Start PostgreSQL database
- Run database migrations
- Build all services

### Manual Setup

1. **Install dependencies:**
   ```bash
   # Web app
   cd web && npm install
   
   # Mobile app
   cd ../mobile && npm install
   
   # Backend
   cd ../backend && go mod tidy
   
   # Image service
   cd ../image-service && pip install -r requirements.txt
   ```

2. **Setup environment files:**
   ```bash
   cp web/env.example web/.env
   cp mobile/env.example mobile/.env
   cp backend/env.example backend/.env
   cp image-service/env.example image-service/.env
   ```

3. **Start database:**
   ```bash
   docker-compose up -d postgres
   ```

4. **Setup database schema:**
   ```bash
   cd web && npx prisma db push
   ```

5. **Start all services:**
   ```bash
   docker-compose up
   ```

### Development URLs

- **Web App:** http://localhost:3000
- **Mobile App:** Scan QR code with Expo Go
- **Backend API:** http://localhost:8080/api/v1
- **Image Service:** http://localhost:8001
- **Database:** localhost:5432

### API Endpoints

- **Backend API:** `http://localhost:8080/api/v1`
- **Image Service:** `http://localhost:8001`
- **Health Checks:** 
  - Backend: `GET /health`
  - Image Service: `GET /health`

### Database

PostgreSQL runs on `localhost:5432` with:
- Database: `kyarafit`
- User: `kyarafit` 
- Password: `password`

---

## Deployment

### Fly.io (Recommended)

1. **Install Fly CLI:**
   ```bash
   curl -L https://fly.io/install.sh | sh
   flyctl auth login
   ```

2. **Deploy services:**
   ```bash
   # Backend
   cd backend && flyctl deploy
   
   # Web app
   cd ../web && flyctl deploy
   
   # Image service
   cd ../image-service && flyctl deploy
   ```

3. **Set environment variables:**
   ```bash
   flyctl secrets set DATABASE_URL="postgresql://..." -a kyarafit-backend
   flyctl secrets set JWT_SECRET="your-secret" -a kyarafit-backend
   ```

### Render

1. **Connect GitHub repository to Render**
2. **Use the included `render.yaml` configuration**
3. **Set environment variables in Render dashboard**

### Docker Compose (Production)

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

For detailed deployment instructions, see [deploy/README.md](deploy/README.md).

---

## Development

### Project Structure

```
Kyarafit/
├── web/                 # Next.js web application
│   ├── src/
│   │   ├── app/        # App router pages
│   │   ├── lib/        # Utilities and auth
│   │   └── components/ # React components
│   └── prisma/         # Database schema
├── mobile/             # React Native + Expo app
│   ├── src/
│   │   ├── screens/    # App screens
│   │   └── lib/        # Utilities and auth
│   └── app.json        # Expo configuration
├── backend/            # Go API server
│   ├── database/       # Database connection
│   ├── middleware/     # Auth middleware
│   └── migrations/     # SQL migrations
├── image-service/      # Python FastAPI service
│   ├── main.py        # FastAPI app
│   └── requirements.txt
├── docker-compose.yml  # Local development
├── setup.sh           # Setup script
└── deploy/            # Deployment configs
```

### Available Scripts

```bash
# Setup everything
./setup.sh

# Start all services (including mobile)
./start-project.sh

# Start only mobile app (background)
./start-mobile.sh

# Start mobile app (interactive mode)
./start-mobile-interactive.sh

# Stop all services
./stop-project.sh

# Start individual services
cd web && npm run dev
cd mobile && npx expo start
cd backend && go run main.go
cd image-service && python3 -m uvicorn main:app --reload --port 8000 --host 0.0.0.0

# Database operations
cd web && npx prisma studio
cd web && npx prisma db push
cd web && npx prisma generate

# Testing
cd web && npm test
cd backend && go test ./...
cd image-service && python -m pytest
```

---

## Roadmap

- [ ] Closet and build CRUD functionality
- [ ] Coord builder with export support
- [ ] Wishlist with product scraping and stock tracking
- [ ] Push notifications for restocks and drops
- [ ] Convention planner with packing list generator
- [ ] Group builds and sharing features
- [ ] Stats dashboard for spending and build history

---

## Licensing

This project is proprietary and all rights are reserved.  
No part of the codebase, documentation, or assets may be copied, modified, distributed, or used commercially without prior written permission from the copyright holder.

---

## Contributing

Contributions may be accepted on an invite-only basis.  
If you are interested in collaborating, please contact the repository owner to discuss access and contributor terms.

---

## Contact

For business inquiries or partnership opportunities, please contact:  
**David Xiao** – dxiao3043@gmail.com - website: https://www.davidx.tech

