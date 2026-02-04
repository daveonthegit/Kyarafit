# Kyarafit – Project Structure

## Monorepo Layout
Kyarafit/
├── mobile/            # Expo React Native app
├── web/               # Next.js web app
├── backend/           # Go API server
├── image-service/     # FastAPI image processing
├── docker-compose.yml
├── docs/
└── README.md

## Backend Structure
backend/
├── cmd/api/main.go
├── internal/
│   ├── auth/
│   ├── closet/
│   ├── builds/
│   ├── coords/
│   ├── wishlist/
│   ├── conventions/
│   ├── groups/
│   ├── users/
│   ├── middleware/
│   ├── db/
│   ├── cache/
│   └── config/
├── migrations/
└── pkg/utils/