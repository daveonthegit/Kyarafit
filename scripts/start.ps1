# Kyarafit startup: docker-compose + optional local dev servers.
# Usage: .\scripts\start.ps1 [-NoDocker] [-NoWeb] [-NoMobile]

param(
    [switch]$NoDocker,
    [switch]$NoWeb,
    [switch]$NoMobile
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Log { Write-Host "[start] $args" -ForegroundColor Cyan }
function Ok  { Write-Host "[start] $args" -ForegroundColor Green }
function Warn { Write-Host "[start] $args" -ForegroundColor Yellow }

# Env
if (-not (Test-Path "$Root\.env")) {
    if (Test-Path "$Root\.env.example") {
        Copy-Item "$Root\.env.example" "$Root\.env"
        Log "Created .env from .env.example"
    }
}

# Dependencies
if (-not (Test-Path "$Root\node_modules")) {
    Log "Installing npm dependencies..."
    npm install
    Ok "npm install done"
}

# Docker
if (-not $NoDocker) {
    Log "Starting Docker (postgres, backend, image-service)..."
    docker compose up -d
    Ok "Docker services up"
} else {
    Warn "Skipping Docker (-NoDocker)"
}

# Web
if (-not $NoWeb) {
    Log "Starting web (Next.js) in new window..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; npm run dev:web"
    Start-Sleep -Seconds 2
    Ok "Web: http://localhost:3000"
}

# Mobile (--clear so Expo Router Babel plugin / require.context works)
if (-not $NoMobile) {
    Log "Starting mobile (Expo) in new window (cache clear for Expo Router)..."
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; npm run start -w mobile -- --clear"
    Ok "Mobile: Expo DevTools (see new window for QR)"
}

Write-Host ""
Ok "Startup done."
Write-Host "  Web:    http://localhost:3000"
Write-Host "  Closet: http://localhost:3000/closet"
Write-Host "  API:    http://localhost:8080/health"
Write-Host "  Stop:   .\scripts\stop.ps1 or docker compose down"
Write-Host ""
