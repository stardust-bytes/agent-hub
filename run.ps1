param(
  [switch]$Docker
)

if ($Docker) {
  Write-Host "=== Building and starting with Docker ===" -ForegroundColor Cyan
  docker compose up --build
  exit
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  171305 AI Workspace - Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
  Write-Host "[ERROR] Node.js is not installed. Please install Node.js 20+ from https://nodejs.org" -ForegroundColor Red
  exit 1
}
Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green

# Copy .env if not exists
$envFile = Join-Path $PSScriptRoot "backend\.env"
$envExample = Join-Path $PSScriptRoot "backend\.env.example"
if (-not (Test-Path $envFile)) {
  Copy-Item $envExample $envFile
  Write-Host "[OK] Created backend\.env from .env.example" -ForegroundColor Green
} else {
  Write-Host "[OK] backend\.env already exists" -ForegroundColor Green
}

# Install backend dependencies
Write-Host "" -ForegroundColor Cyan
Write-Host ">>> Installing backend dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "backend")
npm install --silent 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] npm install failed in backend" -ForegroundColor Red; exit 1 }
npx prisma generate 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] prisma generate failed" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Backend ready" -ForegroundColor Green

# Install frontend dependencies
Write-Host "" -ForegroundColor Cyan
Write-Host ">>> Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location (Join-Path $PSScriptRoot "frontend")
npm install --silent 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Host "[ERROR] npm install failed in frontend" -ForegroundColor Red; exit 1 }
Write-Host "[OK] Frontend ready" -ForegroundColor Green

Set-Location $PSScriptRoot

# Start backend
Write-Host "" -ForegroundColor Cyan
Write-Host ">>> Starting backend (port 13596)..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "npx.cmd" -ArgumentList "nest start --watch" -WorkingDirectory (Join-Path $PSScriptRoot "backend") -NoNewWindow -PassThru

Start-Sleep -Seconds 3

# Start frontend
Write-Host ">>> Starting frontend (port 17135)..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath "npx.cmd" -ArgumentList "vite" -WorkingDirectory (Join-Path $PSScriptRoot "frontend") -NoNewWindow -PassThru

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Frontend: http://localhost:17135" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:13596" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Magenta

try {
  while ($true) { Start-Sleep -Seconds 1 }
} finally {
  if ($backendJob -and !$backendJob.HasExited) { $backendJob.Kill() }
  if ($frontendJob -and !$frontendJob.HasExited) { $frontendJob.Kill() }
}
