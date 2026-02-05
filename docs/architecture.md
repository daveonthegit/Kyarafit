# Kyarafit – Architecture

## Overview

Service-oriented architecture optimized for mobile-first usage.

- Go API backend
- Python image processing service
- PostgreSQL + Redis
- Cloudflare Images CDN

## Image Flow

1. Client uploads image to backend (`POST /api/v1/upload/image`).
2. Backend uploads original to Supabase Storage and returns its URL.
3. If `IMAGE_SERVICE_URL` is set, backend calls the image service (`POST /remove-bg`); on success, the no-background PNG is uploaded to Storage and returned as `url_no_bg` (optional).
4. Backend returns `url` (always) and `url_no_bg` (when image service is configured and succeeds). Client or backend updates the item record with the chosen URL(s).

## Offline Strategy

- Cached reads
- Queued writes
- Sync on reconnect
