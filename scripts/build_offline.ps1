# PowerShell Offline Build & Packaging Script for ChronoGrad VR
param(
    [string]$OutputDir = "bin"
)

$ErrorActionPreference = "Stop"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "[ChronoGrad VR] Packaging Standalone LAN Binaries" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "`n[1/3] Running tests (Storage, Physics, Agents)..." -ForegroundColor Yellow
go test -v ./internal/physics/... ./internal/storage/... ./internal/agents/...

Write-Host "`n[2/3] Compiling Windows Standalone Binary..." -ForegroundColor Yellow
$env:GOOS = "windows"
$env:GOARCH = "amd64"
$env:CGO_ENABLED = "0"
go build -trimpath -ldflags="-s -w" -o "$OutputDir/game-server.exe" ./cmd/game-server

Write-Host "`n[3/3] Compiling AI Benchmark Utility..." -ForegroundColor Yellow
go build -trimpath -o "$OutputDir/ai-bench.exe" ./cmd/ai-bench

Write-Host "`n[SUCCESS] All standalone binaries built into ./$OutputDir/" -ForegroundColor Green
