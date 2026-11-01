#!/bin/bash
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"
set -euo pipefail
cd -- "$(dirname -- "$0")"
case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) server="bin/game-server" ;;
  Darwin-arm64) server="bin/game-server-macos-arm64" ;;
  *) echo "This package supports Linux x64, Windows x64 and macOS Apple Silicon. See README.md for source builds." >&2; exit 1 ;;
esac
export OLLAMA_ENABLED="${OLLAMA_ENABLED:-true}"
export DEV_WEB_DIR="$PWD/web"
if [[ ! -f "$DEV_WEB_DIR/css/flight-deck.css" ]]; then echo "Updated frontend missing. Extract the complete archive." >&2; exit 1; fi
printf '%s\n' 'Open http://localhost:8080 in your browser.' 'Other players: use Invite in the game and join the same room.' 'Stop the host with Ctrl+C.'
exec "./$server"
