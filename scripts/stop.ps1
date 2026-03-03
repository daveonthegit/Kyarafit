# Stop Docker services and any dev-server processes on known ports.
# Ports:
#   3000  - Next.js web
#   8000  - Image service (Docker / FastAPI)
#   8081  - Expo Metro bundler
#   8082  - Expo Metro (fallback)
#   19000 - Expo Go
#   19001 - Expo DevTools
#   19002 - Expo web DevTools

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Stop-Port {
    param([int]$Port)
    $killed = $false

    # Primary: Get-NetTCPConnection (fastest on modern Windows)
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
                 Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" }
        foreach ($conn in $conns) {
            $pid = $conn.OwningProcess
            if ($pid -and $pid -gt 4) {   # PID 4 = System — never kill
                Write-Host "[stop] Killing PID $pid on port $Port" -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                $killed = $true
            }
        }
    } catch {}

    # Fallback: netstat (catches cases Get-NetTCPConnection misses)
    if (-not $killed) {
        $lines = netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
        foreach ($line in $lines) {
            $parts = ($line.Line -split '\s+') | Where-Object { $_ -ne '' }
            $pid = $parts[-1]
            if ($pid -match '^\d+$' -and [int]$pid -gt 4) {
                Write-Host "[stop] Killing PID $pid on port $Port (fallback)" -ForegroundColor Yellow
                Stop-Process -Id ([int]$pid) -Force -ErrorAction SilentlyContinue
                $killed = $true
            }
        }
    }

    if (-not $killed) {
        Write-Host "[stop] Port $Port is free" -ForegroundColor DarkGray
    }
}

Write-Host "[stop] Stopping Docker services..." -ForegroundColor Cyan
docker compose down 2>$null

Write-Host "[stop] Freeing ports..." -ForegroundColor Cyan
Stop-Port -Port 3000   # Next.js web
Stop-Port -Port 8000   # Image service
Stop-Port -Port 8081   # Expo Metro
Stop-Port -Port 8082   # Expo Metro fallback
Stop-Port -Port 19000  # Expo Go
Stop-Port -Port 19001  # Expo DevTools
Stop-Port -Port 19002  # Expo web DevTools

Write-Host "[stop] Done." -ForegroundColor Green
