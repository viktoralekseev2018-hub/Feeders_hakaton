// Package app provides the shared source and release launcher.
package app

import (
	"fmt"
	"log/slog"
	"os"

	"feeders/internal/mcpapp"
)

const usage = `LastCrew FlightDeck

Run from the project directory:
  go run .                    Build and start the game
  go build -o lastcrew .       Build once
  ./lastcrew                  Start the compiled game

Open http://localhost:8080. Stop with Ctrl+C.
world/ and knowledge/ must remain in the working directory.
Ollama runs separately; the default model is qwen3:4b-instruct-2507-q4_K_M.

Environment:
  HOST_ADDR        Listen address (default 0.0.0.0:8080)
  DATA_DIR         Saved games and accounts (default data)
  OLLAMA_ENABLED   Set false to use reference answers without the model
  OLLAMA_MODEL     Local Ollama model name
  OLLAMA_URL       Local Ollama endpoint (default http://127.0.0.1:11434)
  DEV_WEB_DIR      Optional frontend directory instead of embedded files
  MCP_BINARY      Optional standalone MCP executable instead of this binary

Tools:
  --mcp [flags]   Run the embedded MCP stdio server (internal use)
  --help          Show this help
`

func Main() {
	// MCP stdout must contain only JSON-RPC, with no host logs or database startup.
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "--mcp":
			mcpapp.Main(os.Args[2:])
			return
		case "--help", "-h":
			fmt.Print(usage)
			return
		default:
			fmt.Fprintf(os.Stderr, "Unknown argument: %s\nUse --help for launch instructions.\n", os.Args[1])
			os.Exit(2)
		}
	}
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("host stopped", "error", err)
		os.Exit(1)
	}
}
