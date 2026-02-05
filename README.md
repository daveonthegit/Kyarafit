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

3. **Run the backend** (health + Closet API)

   ```bash
   cd backend && go run .
   ```
   Requires `DATABASE_URL` (e.g. from docker-compose). Migrations run on startup. Endpoints: `GET /health`, `GET/POST/PATCH/DELETE /closet/items` with header `x-kyar-device-id`.

4. **Run the web app**

   ```bash
   npm run dev:web
   ```
   Open [http://localhost:3000](http://localhost:3000). Closet: [http://localhost:3000/closet](http://localhost:3000/closet); add item via "NEW ITEM" → [http://localhost:3000/closet/new](http://localhost:3000/closet/new). Device id is stored in localStorage.

5. **Run the mobile app**

   ```bash
   npm run dev:mobile
   ```
   Use Expo Go. Builds tab → Closet; add item via FAB. Offline-first: items stored in SQLite and synced when online (outbox).

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

## Account tiers

Access is tiered; enforcement is central in the backend (see `backend/internal/tier`).

| Tier | Web editor | Export/import | Online backup | Multi-device sync | Storage | Max builds | Max conventions |
|------|------------|---------------|---------------|-------------------|---------|------------|-----------------|
| **ANON** | No | No | No | No | — | — | — |
| **FREE** | Yes | No | No | No | 50 MB | 5 | 1 |
| **PREMIUM_BASIC** | Yes | JSON | Yes | Yes | 500 MB | 20 | 5 |
| **PREMIUM_PRO** | Yes | JSON, CSV, PDF | Yes | Yes | Unlimited | Unlimited | Unlimited |

- **Web app:** Requires at least a FREE account (sign-in required). Anonymous users cannot use the web editor.
- **Export:** PREMIUM_BASIC+ for JSON; PREMIUM_PRO for CSV/PDF.
- **Sync (mobile → backend):** PREMIUM_BASIC+ required for mobile sync; FREE can use the web editor with limits.
- **Storage:** Backend tracks usage; over limit returns a calm “Storage limit reached. Upgrade to continue backing up.” No hard deletes on downgrade.

Stripe: one product “Kyarafit Premium”, two prices (BASIC → PREMIUM_BASIC, PRO → PREMIUM_PRO). Webhook `POST /webhooks/stripe` updates user tier and quota. Set `STRIPE_PRICE_BASIC` and `STRIPE_PRICE_PRO` in backend env.

## Design rules

- **Prototype (look and flow):** [example screens/prototype/code.html](example%20screens/prototype/code.html) — the app UI follows this editorial look and navigation (The Lookbook, Current Focus hero, Next Deadline, The Closet with category tabs, bottom nav, FAB).
- **Component spec:** [design-system/component_spec.md](design-system/component_spec.md)  
- **Design lint (anti-drift):** [design-system/design_lint.md](design-system/design_lint.md)  
- **UI audit:** See [design-system/README.md#ui-audit](design-system/README.md#ui-audit) for banned patterns (boxed inputs, pill buttons, colorful chips, gradients).

Editorial UI: serif display for titles, sans for body, underlined inputs, sharp buttons, minimal chrome. Shared consistency via design-system tokens and component specs; do not invent new styles.

## Tech stack

- **Mobile:** Expo React Native (TypeScript), Expo Router, TanStack Query, Zustand, expo-sqlite (offline-first closet), design-system RN tokens
- **Web:** Next.js 14, App Router, Tailwind (token-aligned), TanStack Query, design-system
- **Backend:** Go, Fiber; health + real Closet API (`GET/POST/PATCH/DELETE /closet/items`) with device-scoped storage
- **DB:** PostgreSQL (docker-compose); migrations in `backend/migrations/`
- **Image service:** FastAPI stub; rembg not implemented yet

## Quality

- Web: typecheck `cd web && npx tsc --noEmit`, lint `npm run lint -w web`
- Mobile: typecheck `cd mobile && npx tsc --noEmit`, lint `npm run lint -w mobile`
- Backend: `cd backend && go build .` and `go test ./internal/closet/...`

## Closet vertical slice – commands and test flows

**1. Backend (with Postgres)**

```bash
# Start Postgres
docker-compose up -d

# Run backend (migrations + Closet API)
cd backend && go run .
```

- Health: `curl http://localhost:8080/health`
- List (requires device id): `curl -H "x-kyar-device-id: dev-test-1" http://localhost:8080/closet/items`
- Create: `curl -X POST -H "Content-Type: application/json" -H "x-kyar-device-id: dev-test-1" -d "{\"name\":\"Test Wig\",\"category\":\"wig\",\"tags\":[]}" http://localhost:8080/closet/items`

**2. Web**

```bash
npm run dev:web
```

- Open [http://localhost:3000/closet](http://localhost:3000/closet) → list (from backend).
- Click FAB or "NEW ITEM" → [http://localhost:3000/closet/new](http://localhost:3000/closet/new) → submit form → redirect to `/closet`; item appears (optimistic then from server). Refresh: item persists (device id in `localStorage`).

**3. Mobile**

```bash
npm run dev:mobile
```

- Builds tab → Closet → Add Item (FAB) → fill form, optional photo → Save → back to Closet; item appears from SQLite.
- **Offline:** enable airplane mode, add 2 items, restart app → items still in list. Disable airplane mode → sync runs; outbox clears. Items then visible on backend (same device id if you copy it to web for testing).
**4. Cross-check**

- Use same device id on web (e.g. set in localStorage: `kyar_device_id` = the value from mobile’s storage) to see the same items on both after sync.
