// Package agents provides local, grounded NPC conversations through Ollama.
package npc

import (
	"context"
	"feeders/internal/rag"
)

type Request struct {
	Scope    string
	PlayerID string
	AgentID  string
	Text     string
}

type Reply struct {
	Model          string      `json:"model,omitempty"`
	FallbackReason string      `json:"fallback_reason,omitempty"`
	ToolTransport  string      `json:"tool_transport,omitempty"`
	AgentID        string      `json:"agent_id"`
	Text           string      `json:"text"`
	Status         string      `json:"status"`
	Evidence       []rag.Chunk `json:"evidence"`
	Mode           string      `json:"mode"`
	MissionVersion uint64      `json:"mission_version,omitempty"`
	Analysis       any         `json:"analysis,omitempty"`
}

// Service implementations use local resources only; remember prior interactions
// per (player, agent). Respect context cancellation, timeouts and bounded concurrency.
type Service interface {
	Talk(context.Context, Request) (Reply, error)
}

func (r Request) memoryPlayer() string {
	if r.Scope != "" {
		return r.Scope + "/" + r.PlayerID
	}
	return r.PlayerID
}
