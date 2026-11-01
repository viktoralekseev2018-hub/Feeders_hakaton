@echo off
setlocal
cd /d "%~dp0"
if not defined OLLAMA_ENABLED set "OLLAMA_ENABLED=true"
set "DEV_WEB_DIR=%~dp0web"
if not exist "web\css\flight-deck.css" (echo Updated frontend missing. Extract the complete archive. & pause & exit /b 1)
echo Open http://localhost:8080 in your browser.
echo Other players: use Invite in the game and join the same room.
if not exist "bin\game-server.exe" (echo Missing binary. Extract the complete archive. & pause & exit /b 1)
bin\game-server.exe
pause
endlocal
