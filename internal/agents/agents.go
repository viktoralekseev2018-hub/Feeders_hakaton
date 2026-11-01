// Package agents defines the local AI adapter, queue orchestrator and Ollama client.
package agents

import (
	"context"
	"feeders/internal/rag"
)

type Request struct {
	Scope    string `json:"-"`
	PlayerID string `json:"player_id"`
	AgentID  string `json:"agent_id"`
	Text     string `json:"text"`
}

type Reply struct {
	Model          string      `json:"model,omitempty"`
	FallbackReason string      `json:"fallback_reason,omitempty"`
	ToolTransport  string      `json:"tool_transport,omitempty"`
	AgentID        string      `json:"agent_id"`
	AgentName      string      `json:"agent_name"`
	Text           string      `json:"text"`
	Citation       *Citation   `json:"citation,omitempty"`
	Citations      []Citation  `json:"citations,omitempty"`
	Evidence       []rag.Chunk `json:"evidence,omitempty"`
	Analysis       any         `json:"analysis,omitempty"`
	Mode           string      `json:"mode,omitempty"`
}

// Service implementations use local resources only; remember prior interactions
// per (player, agent). Respect context cancellation, timeouts and bounded concurrency.
type Service interface {
	Talk(context.Context, Request) (Reply, error)
}
