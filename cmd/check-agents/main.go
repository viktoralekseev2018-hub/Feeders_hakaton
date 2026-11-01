// Run against the installed local Ollama, through the same RAG/persona client
// as the game. Does not create accounts, change mission data or require a port.
package main

import (
	"context"
	"encoding/json"
	"feeders/internal/knowledge"
	"feeders/internal/npc"
	"feeders/internal/rag"
	"fmt"
	"os"
	"time"
)

func main() {
	model := os.Getenv("OLLAMA_MODEL")
	if model == "" {
		model = "qwen3:4b-instruct-2507-q4_K_M"
	}
	url := os.Getenv("OLLAMA_URL")
	if url == "" {
		url = "http://127.0.0.1:11434"
	}
	store, err := rag.Load("knowledge")
	if err != nil {
		panic(err)
	}
	local, err := npc.NewLocal(knowledge.Catalog{Store: store}, url, model)
	if err != nil {
		panic(err)
	}
	failed := false
	for _, tc := range []struct{ id, q string }{{"savinykh", "Что произошло на станции Салют-7 в 1985 году?"}, {"dzhanibekov", "Как Джанибеков проверял ручное управление при отказе автоматики?"}, {"ryazansky", "Где Рязанский изучал биохимию и работал до космических полётов?"}, {"krikalev", "Как Крикалёв поддерживал любительскую радиосвязь со школьниками?"}} {
		at := time.Now()
		answer, err := local.Talk(context.Background(), npc.Request{Scope: "local-model-check", PlayerID: "diagnostic", AgentID: tc.id, Text: tc.q})
		result := map[string]any{"agent": tc.id, "model": model, "mode": answer.Mode, "elapsed_ms": time.Since(at).Milliseconds(), "evidence_count": len(answer.Evidence), "text": answer.Text, "fallback_reason": answer.FallbackReason}
		if err != nil {
			result["error"] = err.Error()
		}
		if err != nil || answer.Mode != "model" {
			failed = true
		}
		_ = json.NewEncoder(os.Stdout).Encode(result)
	}
	if failed {
		fmt.Fprintln(os.Stderr, "Not every agent returned a verified model answer.")
		os.Exit(1)
	}
}
