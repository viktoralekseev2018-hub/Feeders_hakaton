param([switch]$WebDist)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    New-Item -ItemType Directory -Path bin -Force | Out-Null
    if ($WebDist) {
        if (-not (Test-Path -LiteralPath web/dist/index.html)) {
            throw 'Build the frontend into web/dist before using -WebDist.'
        }
        go build -tags webdist -trimpath -o bin/game-server.exe ./cmd/game-server
    } else {
        go build -trimpath -o bin/game-server.exe ./cmd/game-server
    }
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed' }
} finally {
    Pop-Location
}
