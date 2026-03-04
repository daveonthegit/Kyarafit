# Kyarafit startup script
# Usage: .\scripts\start.ps1 [-NoWeb] [-NoMobile] [-NoConvex] [-SingleTerminal]
#   -SingleTerminal: run Convex/Web/Mobile in same terminal; type :q to stop all.

param(
    [switch]$NoWeb,
    [switch]$NoMobile,
    [switch]$NoConvex,
    [switch]$SingleTerminal
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Log  { Write-Host "[start] $args" -ForegroundColor Cyan }
function Ok   { Write-Host "[start] $args" -ForegroundColor Green }
function Warn { Write-Host "[start] $args" -ForegroundColor Yellow }

function Kill-Port {
    param([int]$Port)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                 Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" }
        foreach ($conn in $conns) {
            $pid = $conn.OwningProcess
            if ($pid -and $pid -gt 4) {
                Write-Host "  [port] Freeing port $Port (PID $pid)" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch {}
    # Fallback via netstat
    $lines = netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $parts = ($line.Line -split '\s+') | Where-Object { $_ -ne '' }
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 4) {
            Write-Host "  [port] Freeing port $Port (PID $pid, fallback)" -ForegroundColor Yellow
            Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
        }
    }
}

# Ports used by the stack (kill anything on these before starting)
$NeededPorts = @(3000, 8081, 8082, 19000, 19001, 19002)

# ── 1. Clean slate ─────────────────────────────────────────────────────────────
Log "Stopping existing dev servers..."
try { & "$Root\scripts\stop.ps1" } catch { Warn "Stop step had errors (continuing): $_" }
Start-Sleep -Seconds 1
Log "Killing any remaining processes on needed ports..."
foreach ($p in $NeededPorts) { Kill-Port -Port $p }
Start-Sleep -Seconds 1
Ok "Clean slate."

# ── 2. Env ─────────────────────────────────────────────────────────────────────
if (-not (Test-Path "$Root\.env")) {
    if (Test-Path "$Root\.env.example") {
        Copy-Item "$Root\.env.example" "$Root\.env"
        Log "Created .env from .env.example"
    }
}

# ── 3. Dependencies ────────────────────────────────────────────────────────────
if (-not (Test-Path "$Root\node_modules")) {
    Log "Installing npm dependencies..."
    npm install
    Ok "npm install done"
}

# ── 4. Convex dev server ───────────────────────────────────────────────────────
if (-not $NoConvex) {
    if ($SingleTerminal) {
        Log "Starting Convex dev server (background)..."
        Start-Job -Name Convex -ScriptBlock { Set-Location $using:Root; npx convex dev } | Out-Null
        Start-Sleep -Seconds 2
        Ok "Convex dev server starting"
    } else {
        Log "Starting Convex dev server in new window..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; npx convex dev"
        Start-Sleep -Seconds 2
        Ok "Convex dev server starting"
    }
}

# ── 5. Web (Next.js on :3000) ─────────────────────────────────────────────────
if (-not $NoWeb) {
    Log "Freeing port 3000 before web..."
    Kill-Port -Port 3000
    if ($SingleTerminal) {
        Log "Starting web (Next.js, background)..."
        Start-Job -Name Web -ScriptBlock { Set-Location $using:Root; npm run dev:web } | Out-Null
        Start-Sleep -Seconds 2
        Ok "Web: http://localhost:3000"
    } else {
        Log "Starting web (Next.js) in new window..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; npm run dev:web"
        Start-Sleep -Seconds 2
        Ok "Web: http://localhost:3000"
    }
}

# ── 6. Mobile (Expo on :8081 / :19000) ───────────────────────────────────────
if (-not $NoMobile) {
    Log "Freeing Expo ports (8081, 8082, 19000, 19001, 19002)..."
    foreach ($p in 8081, 8082, 19000, 19001, 19002) { Kill-Port -Port $p }
    if ($SingleTerminal) {
        Log "Starting mobile (Expo, background)..."
        Start-Job -Name Mobile -ScriptBlock { Set-Location $using:Root; npm run start -w mobile -- --clear } | Out-Null
        Ok "Mobile: Expo (background)"
    } else {
        Log "Starting mobile (Expo) in new window..."
        Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root'; npm run start -w mobile -- --clear"
        Ok "Mobile: Expo DevTools (see new window for QR)"
    }
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Ok "Startup done."
Write-Host "  Web:          http://localhost:3000"
Write-Host "  Closet:       http://localhost:3000/closet"
Write-Host "  Conventions:  http://localhost:3000/conventions"
Write-Host "  Stop:         .\scripts\stop.ps1"
Write-Host "  One terminal + :q to stop:  .\scripts\start.ps1 -SingleTerminal" -ForegroundColor DarkGray
if ($SingleTerminal) {
    Write-Host ""
    Write-Host "  Type  :q  and Enter to stop all services and exit." -ForegroundColor Yellow
    Write-Host ""
    do {
        $input = Read-Host "  (or press Enter to keep running)"
        if ($input -eq ':q') {
            Log "Stopping all services..."
            try { & "$Root\scripts\stop.ps1" } catch { Warn "Stop had errors: $_" }
            Get-Job -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
            Ok "Done. Exiting."
            exit 0
        }
    } while ($true)
}
Write-Host ""
Write-Host "  NOTE: Convex handles the database. No Go backend needed." -ForegroundColor DarkGray
Write-Host ""
