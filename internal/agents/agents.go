// Package agents defines the future local AI adapter, not an Ollama implementation.
package agents

import "context"

type Request struct {
	PlayerID string
	AgentID  string
	Text     string
}

type Reply struct{ Text string }

// Service implementations use local resources only; remember prior interactions
// per (player, agent). Respect context cancellation, timeouts and bounded concurrency.
type Service interface {
	Talk(context.Context, Request) (Reply, error)
}
