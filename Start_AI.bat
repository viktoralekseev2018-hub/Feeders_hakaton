@echo off
setlocal
cd /d "%~dp0"
set "OLLAMA_ENABLED=true"
set "DEV_WEB_DIR=%~dp0web"
if not exist "web\css\flight-deck.css" (echo Updated frontend missing. Extract the complete archive. & pause & exit /b 1)
if not defined OLLAMA_URL set "OLLAMA_URL=http://127.0.0.1:11434"
if not defined OLLAMA_MODEL set "OLLAMA_MODEL=qwen3:8b"
echo RAG + local model: %OLLAMA_MODEL%
echo Ollama must be running with this model already downloaded.
echo Setup and test questions: docs\crew-rag.md
echo Open http://localhost:8080 in your browser.
bin\game-server.exe
pause
endlocal
