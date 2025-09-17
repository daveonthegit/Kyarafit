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

### Development Setup

1. **Clone and start all services:**
   ```bash
   git clone <repository-url>
   cd Kyarafit
   docker-compose up -d
   ```

2. **Web App (Next.js):**
   ```bash
   cd web
   npm install
   npm run dev
   # Visit http://localhost:3000
   ```

3. **Mobile App (Expo):**
   ```bash
   cd mobile
   npm install
   npx expo start
   # Scan QR code with Expo Go app
   ```

4. **Backend API (Go):**
   ```bash
   cd backend
   go mod download
   go run main.go
   # API available at http://localhost:8080
   ```

5. **Image Service (Python):**
   ```bash
   cd image-service
   pip install -r requirements.txt
   python main.py
   # Service available at http://localhost:8001
   ```

### Environment Variables

Copy the example environment files and configure:

```bash
# Backend
cp backend/env.example backend/.env

# Image Service  
cp image-service/env.example image-service/.env
```

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

