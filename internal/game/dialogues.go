package game

import (
	"context"
	"feeders/internal/agents"
	"feeders/internal/realtime"
	"feeders/pkg/protocol"
	"fmt"
)

type DialogueMessage struct {
	Role  string        `json:"role"`
	Text  string        `json:"text"`
	Reply *agents.Reply `json:"reply,omitempty"`
}

func (m *Module) dialogueHistory(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var p struct {
		AgentID string `json:"agent_id"`
	}
	if protocol.DecodePayload(e.Payload, &p) != nil {
		sendError(s, e, "invalid_payload", "Выберите наставника")
		return
	}
	m.roomMu.Lock()
	defer m.roomMu.Unlock()
	r := m.rooms[m.membership[s.User().ID]]
	rows := []DialogueMessage{}
	if r != nil {
		if v := r.Dialogues[s.User().ID+"/"+p.AgentID]; v != nil {
			rows = v
		}
	}
	s.Send("dialogue.history", e.RequestID, map[string]any{"messages": rows})
}
func (m *Module) recordDialogue(id, scope, agent, text string, reply agents.Reply) error {
	m.roomMu.Lock()
	defer m.roomMu.Unlock()
	r := m.rooms[m.membership[id]]
	if r == nil {
		return nil
	}
	if scope != fmt.Sprintf("%s:%d", r.Code, r.Generation) {
		return context.Canceled
	}
	if r.Dialogues == nil {
		r.Dialogues = map[string][]DialogueMessage{}
	}
	key := id + "/" + agent
	rows := append(r.Dialogues[key], DialogueMessage{Role: "user", Text: text}, DialogueMessage{Role: "assistant", Text: reply.Text, Reply: &reply})
	if len(rows) > 40 {
		rows = rows[len(rows)-40:]
	}
	r.Dialogues[key] = rows
	return m.persistRoomsLocked()
}
