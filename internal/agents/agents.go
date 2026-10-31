// Package agents defines the local AI adapter, queue orchestrator and Ollama client.
package agents

import "context"

type Request struct {
	PlayerID string `json:"player_id"`
	AgentID  string `json:"agent_id"`
	Text     string `json:"text"`
}

type Reply struct {
	AgentID   string    `json:"agent_id"`
	AgentName string    `json:"agent_name"`
	Text      string    `json:"text"`
	Citation  *Citation `json:"citation,omitempty"`
}

// Service implementations use local resources only; remember prior interactions
// per (player, agent). Respect context cancellation, timeouts and bounded concurrency.
type Service interface {
	Talk(context.Context, Request) (Reply, error)
}
