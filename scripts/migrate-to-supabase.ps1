# Migrate existing schema to Supabase (Windows)
# Usage: .\scripts\migrate-to-supabase.ps1 "postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres"

param(
    [Parameter(Mandatory=$true)]
    [string]$ConnectionString
)

Write-Host "Running migrations on Supabase..." -ForegroundColor Green

Push-Location backend

Get-ChildItem -Path "migrations\*.up.sql" | Sort-Object Name | ForEach-Object {
    Write-Host "Running $($_.Name)..." -ForegroundColor Cyan
    $content = Get-Content $_.FullName -Raw
    # Use psql or execute via Supabase API
    Write-Host "  Copy and paste this into Supabase SQL Editor:" -ForegroundColor Yellow
    Write-Host $content
    Write-Host "`n---`n" -ForegroundColor Gray
}

Pop-Location

Write-Host "`n✅ Review migrations above and run them in Supabase SQL Editor" -ForegroundColor Green
Write-Host "Go to: https://supabase.com/dashboard/project/[your-project]/sql" -ForegroundColor Cyan
