@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo [ChronoGrad VR / Helios-7] Offline Packaging Script
echo Target: Windows (x64) and Linux (x64) Standalone LAN
echo Mode: 100%% Offline (go:embed Web Assets + SQLite WAL)
echo ===================================================

if not exist "bin" mkdir "bin"

echo [1/4] Running Go Race and Concurrency Tests...
go test -race -v ./internal/storage/... ./internal/physics/... ./internal/agents/...
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Unit and race tests failed!
    exit /b %ERRORLEVEL%
)

echo [2/4] Building Windows Standalone Binary (bin/game-server.exe)...
set GOOS=windows
set GOARCH=amd64
set CGO_ENABLED=0
go build -trimpath -ldflags="-s -w" -o bin/game-server.exe ./cmd/game-server
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Windows build failed!
    exit /b %ERRORLEVEL%
)

echo [3/4] Building Linux Standalone Binary (bin/game-server-linux)...
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0
go build -trimpath -ldflags="-s -w" -o bin/game-server-linux ./cmd/game-server
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Linux build failed!
    exit /b %ERRORLEVEL%
)

echo [4/4] Building AI Benchmarking Utility (bin/ai-bench.exe)...
set GOOS=windows
set GOARCH=amd64
go build -trimpath -o bin/ai-bench.exe ./cmd/ai-bench

echo ===================================================
echo [SUCCESS] Offline packaging completed successfully!
echo Binaries generated in ./bin/
echo ===================================================
