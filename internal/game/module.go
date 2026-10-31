// Package game wires protocol handlers to domain services. It contains no simulation.
package game

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"feeders/internal/model"
	"feeders/internal/realtime"
	"feeders/internal/storage"
	"feeders/internal/world"
	"feeders/pkg/protocol"
)

type Module struct {
	players storage.Players
	world   world.Service
	log     *slog.Logger
	mu      sync.Mutex
	ready   map[string]model.PlayerState
}

// A nil world is the explicit scaffold mode. Accounts and initial state still persist.
func New(players storage.Players, worldService world.Service, log *slog.Logger) *Module {
	return &Module{players: players, world: worldService, log: log, ready: make(map[string]model.PlayerState)}
}

func (m *Module) Register(h *realtime.Hub) {
	h.Handle("player.init", m.init)
	h.Handle("player.input", m.input)
	h.OnDisconnect(m.leave)
}

func (m *Module) init(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	// Legacy username is accepted for compatibility but identity comes from cookie.
	var input struct {
		ClientTime int64  `json:"client_time"`
		Username   string `json:"username"`
	}
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid player.init payload")
		return
	}
	id := s.User().ID
	m.mu.Lock()
	state, exists := m.ready[id]
	m.mu.Unlock()
	if !exists {
		var err error
		state, err = m.players.LoadPlayer(ctx, id)
		if errors.Is(err, storage.ErrNotFound) {
			state = model.PlayerState{PlayerID: id, Position: model.Position{Y: 1.7, Z: 5}, UpdatedAt: time.Now().UTC()}
			err = m.players.SavePlayer(ctx, state)
		}
		if err != nil {
			m.failure(s, e, err)
			return
		}
		if m.world != nil {
			state, err = m.world.Join(ctx, s.User(), state)
			if err != nil {
				m.failure(s, e, err)
				return
			}
		}
		m.mu.Lock()
		m.ready[id] = state
		m.mu.Unlock()
	}
	s.Send("player.ready", e.RequestID, protocol.PlayerReady{User: s.User(), State: state, Capabilities: protocol.Capabilities{Movement: m.world != nil, World: m.world != nil}})
}

func (m *Module) input(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	m.mu.Lock()
	_, ready := m.ready[s.User().ID]
	m.mu.Unlock()
	if !ready {
		sendError(s, e, "not_initialized", "Send player.init first")
		return
	}
	input, err := protocol.DecodeInput(e.Payload)
	if err != nil {
		sendError(s, e, "invalid_payload", "Invalid player.input payload")
		return
	}
	if m.world == nil {
		sendError(s, e, "feature_disabled", "Movement module is not connected")
		return
	}
	if err := m.world.Input(ctx, s.User().ID, input); err != nil {
		sendError(s, e, "input_rejected", "Movement rejected")
		return
	}
}

func (m *Module) leave(ctx context.Context, user model.User) {
	m.mu.Lock()
	_, exists := m.ready[user.ID]
	delete(m.ready, user.ID)
	m.mu.Unlock()
	if exists && m.world != nil {
		if err := m.world.Leave(ctx, user.ID); err != nil {
			m.log.Error("save departing player", "player_id", user.ID, "error", err)
		}
	}
}
func sendError(s realtime.Session, e protocol.Envelope, code, message string) {
	s.Send("error", e.RequestID, protocol.Error{Code: code, Message: message})
}
func (m *Module) failure(s realtime.Session, e protocol.Envelope, err error) {
	m.log.Error("initialize player", "error", err)
	sendError(s, e, "internal_error", "Cannot initialize player")
}
