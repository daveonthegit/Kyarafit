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

# Stop existing processes first
Log "Stopping existing Docker and dev servers..."
try {
    & "$Root\scripts\stop.ps1"
} catch {
    Warn "Stop step had errors (continuing anyway): $_"
}
Start-Sleep -Seconds 2
Ok "Stopped (if any were running)."

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
function Test-DockerRunning {
    try {
        $null = docker info 2>&1
        return $LASTEXITCODE -eq 0
    } catch { return $false }
}

if (-not $NoDocker) {
    if (-not (Test-DockerRunning)) {
        # Try to start Docker Desktop on Windows
        $dockerDesktop = "${env:ProgramFiles}\Docker\Docker\Docker Desktop.exe"
        if ($IsWindows -ne $false -and (Test-Path $dockerDesktop)) {
            Log "Docker is not running. Starting Docker Desktop..."
            Start-Process -FilePath $dockerDesktop
            $maxWait = 90
            $waited = 0
            while (-not (Test-DockerRunning) -and $waited -lt $maxWait) {
                Start-Sleep -Seconds 3
                $waited += 3
                Write-Host "  Waiting for Docker... ${waited}s" -ForegroundColor Gray
            }
            if (-not (Test-DockerRunning)) {
                Warn "Docker Desktop did not become ready in time. Start it manually and run this script again, or use -NoDocker."
                $NoDocker = $true
            } else {
                Ok "Docker is ready"
            }
        } else {
            Warn "Docker is not running or not installed. Start Docker Desktop from the Start menu, then run this script again, or use -NoDocker to skip."
            Warn "With -NoDocker you must run Postgres and backend yourself (see backend/ and .env)."
            $NoDocker = $true
        }
    }
}
if (-not $NoDocker) {
    Log "Starting Docker (postgres, backend, image-service)..."
    docker compose up -d
    Ok "Docker services up"
} else {
    Warn "Skipping Docker (-NoDocker or Docker not available)"
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
Write-Host "  Web:         http://localhost:3000"
Write-Host "  Closet:      http://localhost:3000/closet"
Write-Host "  Conventions: http://localhost:3000/conventions"
Write-Host "  Packing:     http://localhost:3000/packing"
Write-Host "  API:         http://localhost:8080/health"
Write-Host "  Stop:        .\scripts\stop.ps1 or docker compose down"
Write-Host ""
