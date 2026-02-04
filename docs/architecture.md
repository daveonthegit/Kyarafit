# Kyarafit – Architecture

## Overview
Service-oriented architecture optimized for mobile-first usage.

- Go API backend
- Python image processing service
- PostgreSQL + Redis
- Cloudflare Images CDN

## Image Flow
1. Client uploads image
2. Backend forwards to image service
3. Background removed
4. Image stored in CDN
5. Backend updates item record

## Offline Strategy
- Cached reads
- Queued writes
- Sync on reconnect