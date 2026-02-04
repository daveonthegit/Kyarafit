# Stop Docker and optional dev servers (web on 3000, Expo on 19000).

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Stop-Port {
    param([int]$Port)
    $found = $false
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Listen" }
        if ($conn) {
            $processId = ($conn.OwningProcess | Select-Object -First 1)
            if ($processId) {
                Write-Host "[stop] Stopping process on port $Port (PID: $processId)" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                $found = $true
            }
        }
    } catch { }
    if (-not $found) {
        $line = netstat -ano | Select-String "LISTENING" | Select-String ":$Port "
        if ($line) {
            $processId = ($line -split '\s+')[-1]
            if ($processId -match '^\d+$') {
                Write-Host "[stop] Stopping process on port $Port (PID: $processId)" -ForegroundColor Yellow
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "[stop] Stopping Docker services..." -ForegroundColor Cyan
docker compose down 2>$null

Write-Host "[stop] Stopping dev servers (3000=web, 8081=Metro, 19000=Expo)..." -ForegroundColor Cyan
Stop-Port -Port 3000
Stop-Port -Port 8081
Stop-Port -Port 19000

Write-Host "[stop] Done." -ForegroundColor Green
