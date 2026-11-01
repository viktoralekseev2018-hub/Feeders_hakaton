param([switch]$WebDist)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    $env:CGO_ENABLED = '0'
    New-Item -ItemType Directory -Path bin -Force | Out-Null
    if ($WebDist) {
        if (-not (Test-Path -LiteralPath web/dist/index.html)) {
            throw 'Build the frontend into web/dist before using -WebDist.'
        }
        go build -buildvcs=false -mod=vendor -tags webdist -trimpath -o bin/game-server.exe ./cmd/game-server
    } else {
        go build -buildvcs=false -mod=vendor -trimpath -o bin/game-server.exe ./cmd/game-server
    }
    if ($LASTEXITCODE -ne 0) { throw 'Go build failed' }
    go build -buildvcs=false -mod=vendor -trimpath -o bin/mcp-tools.exe ./cmd/mcp-tools
    if ($LASTEXITCODE -ne 0) { throw 'MCP build failed' }
} finally {
    Pop-Location
}
