# Kyarafit

**Editorial studio notebook for cosplay.**  
Kyarafit is a mobile-first cosplay wardrobe and outfit planning app: closet management, build tracking, visual coord planning, and convention prep in one minimal, editorial-style workspace.

## Repository layout

```
Kyarafit/
├── mobile/           # Expo React Native (TypeScript, Expo Router)
├── web/              # Next.js 14 (TypeScript, App Router, Tailwind)
├── backend/          # Go + Fiber API
├── image-service/    # FastAPI stub (health only; no rembg yet)
├── design-system/    # Shared tokens, Tailwind config, RN tokens, component specs
├── docs/             # Project docs
├── docker-compose.yml
├── Makefile
├── .env.example
└── README.md
```

## Quickstart

1. **Install dependencies (npm workspaces)**

   ```bash
   npm install
   ```

2. **Start Postgres (and optional backend/image-service) with Docker**

   ```bash
   docker-compose up -d
   ```

3. **Run the backend** (health + mock closet list)

   ```bash
   make run-backend
   ```
   Or: `cd backend && go run ./cmd/api`

4. **Run the web app**

   ```bash
   npm run dev:web
   ```
   Open [http://localhost:3000](http://localhost:3000). Home: Lookbook; Closet: [http://localhost:3000/closet](http://localhost:3000/closet) (fetches from API).

5. **Run the mobile app**

   ```bash
   npm run dev:mobile
   ```
   Use Expo Go; tabs: Home, Closet, Plan, Studio. Closet tab fetches from `EXPO_PUBLIC_API_URL/closet/items`.

### Startup script

One-shot start (Docker + web + mobile):

- **Windows:** `start.cmd` or `.\scripts\start.ps1`  
  Optionally: `.\scripts\start.ps1 -NoDocker` or `-NoWeb` / `-NoMobile` to skip services.
- **Mac/Linux/WSL:** `./scripts/start.sh`  
  Optionally: `./scripts/start.sh --no-docker` or `--no-web` / `--no-mobile`.

The script installs npm deps if needed, copies `.env.example` → `.env` when missing, runs `docker compose up -d`, then starts the web and mobile dev servers (on Windows they open in new terminal windows).

**Stop everything:** run `stop.cmd` (Windows) or `./scripts/stop.sh` (Mac/Linux). This runs `docker compose down` and stops processes on ports 3000 (web) and 19000 (Expo).

## Env vars and ports

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Postgres connection string | `postgres://kyarafit:kyarafit@localhost:5432/kyarafit?sslmode=disable` |
| `NEXT_PUBLIC_API_URL` | Backend URL for web | `http://localhost:8080` |
| `EXPO_PUBLIC_API_URL` | Backend URL for mobile | `http://localhost:8080` |

| Service | Port |
|---------|------|
| Postgres | 5432 |
| Backend | 8080 |
| Image service (stub) | 8000 |
| Web (Next.js) | 3000 |

Copy `.env.example` to `.env` and set as needed. Web can use `.env.local` (see `web/.env.local.example`).

## Design rules

- **Prototype (look and flow):** [example screens/prototype/code.html](example%20screens/prototype/code.html) — the app UI follows this editorial look and navigation (The Lookbook, Current Focus hero, Next Deadline, The Closet with category tabs, bottom nav, FAB).
- **Component spec:** [design-system/component_spec.md](design-system/component_spec.md)  
- **Design lint (anti-drift):** [design-system/design_lint.md](design-system/design_lint.md)

Editorial UI: serif display for titles, sans for body, underlined inputs, sharp buttons, minimal chrome. Shared consistency via design-system tokens and component specs; do not invent new styles.

## Tech stack

- **Mobile:** Expo React Native (TypeScript), Expo Router, TanStack Query, Zustand, design-system RN tokens
- **Web:** Next.js 14, App Router, Tailwind (token-aligned), design-system
- **Backend:** Go, Fiber; health + `GET /closet/items` (mock list)
- **DB:** PostgreSQL (docker-compose)
- **Image service:** FastAPI stub; rembg not implemented yet

## Quality

- Web: ESLint, Prettier (`npm run lint`, `npm run format` from root)
- Mobile: Expo lint (`npm run lint` in mobile)
- Backend: `go build ./cmd/api` and run

Keep the baseline minimal: no auth, no sync, no image cutout implementation yet.
