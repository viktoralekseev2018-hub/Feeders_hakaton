// Package game wires protocol handlers to domain services, simulation loop, physics and AI agents.
package game

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"feeders/internal/agents"
	"feeders/internal/model"
	"feeders/internal/physics"
	"feeders/internal/realtime"
	"feeders/internal/storage"
	"feeders/internal/world"
	"feeders/pkg/protocol"
)

type Module struct {
	players  storage.Players
	world    world.Service
	agents   agents.Service
	physics  *physics.Engine
	scenario *ScenarioEngine
	hub      *realtime.Hub
	log      *slog.Logger
	mu       sync.Mutex
	ready    map[string]model.PlayerState
}

// New creates a game module with authoritative world service, physics engine and local AI agents service.
func New(players storage.Players, worldService world.Service, agentService agents.Service, log *slog.Logger) *Module {
	mod := &Module{
		players:  players,
		world:    worldService,
		agents:   agentService,
		physics:  physics.NewEngine(),
		scenario: NewScenarioEngine(),
		log:      log,
		ready:    make(map[string]model.PlayerState),
	}

	// Link learning store to orchestrator if available
	if ls, ok := players.(storage.LearningStore); ok {
		if orch, ok := agentService.(*agents.Orchestrator); ok {
			orch.SetLearningStore(ls)
		}
	}

	return mod
}

func (m *Module) Register(h *realtime.Hub) {
	m.hub = h
	h.Handle("player.init", m.init)
	h.Handle("player.input", m.input)
	h.Handle("agent.talk", m.talk)
	h.Handle("game.action", m.action)
	h.Handle("investigation.solve", m.solve)

	// Stage 5: Relativistic experiment handlers
	h.Handle("experiment.get", m.experimentGet)
	h.Handle("experiment.update", m.experimentUpdate)

	// Stage 6: Learning passport & mistake logging
	h.Handle("passport.get", m.passportGet)
	h.Handle("learning.mistake.record", m.mistakeRecord)

	// Stage 7: Historical quest verification
	h.Handle("quest.herodotus.submit", m.herodotusQuestSubmit)

	h.OnDisconnect(m.leave)
}

func (m *Module) init(ctx context.Context, s realtime.Session, e protocol.Envelope) {
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
			// Спавн в жилом отсеке станции «Горизонт-7» ([-15.0, 1.7, 0.0])
			state = model.PlayerState{
				PlayerID:  id,
				Position:  model.Position{X: -15.0, Y: 1.7, Z: 0.0},
				Yaw:       0,
				LastSeq:   0,
				UpdatedAt: time.Now().UTC(),
			}
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

	s.Send("player.ready", e.RequestID, protocol.PlayerReady{
		User:  s.User(),
		State: state,
		Capabilities: protocol.Capabilities{
			Movement: m.world != nil,
			World:    m.world != nil,
			Agents:   m.agents != nil,
		},
	})
}

func (m *Module) input(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	m.mu.Lock()
	state, ready := m.ready[s.User().ID]
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

	state.Position = model.Position{X: input.X, Y: input.Y, Z: input.Z}
	state.Yaw = input.Yaw
	state.LastSeq = input.Seq
	state.UpdatedAt = time.Now().UTC()

	m.mu.Lock()
	m.ready[s.User().ID] = state
	m.mu.Unlock()
}

func (m *Module) talk(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input struct {
		AgentID string `json:"agent_id"`
		Text    string `json:"text"`
	}
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid agent.talk payload")
		return
	}

	if m.agents == nil {
		sendError(s, e, "feature_disabled", "AI agent service is not connected")
		return
	}

	reply, err := m.agents.Talk(ctx, agents.Request{
		PlayerID: s.User().ID,
		AgentID:  input.AgentID,
		Text:     input.Text,
	})
	if err != nil {
		m.log.Error("agent talk failure", "agent_id", input.AgentID, "error", err)
		sendError(s, e, "agent_error", "AI agent was unable to formulate a response")
		return
	}

	s.Send("agent.reply", e.RequestID, reply)
}

func (m *Module) action(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input protocol.GameActionRequest
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid game.action payload")
		return
	}

	if m.scenario == nil {
		sendError(s, e, "feature_disabled", "Scenario engine is not initialized")
		return
	}

	if input.Action == "get_state" {
		s.Send("game.state", e.RequestID, m.scenario.GetState())
		return
	}

	state, err := m.scenario.ExecuteAction(input.Action)
	if err != nil {
		sendError(s, e, "action_failed", err.Error())
		return
	}

	if m.hub != nil {
		m.hub.Broadcast("game.state", state)
	} else {
		s.Send("game.state", e.RequestID, state)
	}
}

func (m *Module) solve(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input protocol.InvestigationSolveRequest
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid investigation.solve payload")
		return
	}

	if m.scenario == nil {
		sendError(s, e, "feature_disabled", "Scenario engine is not initialized")
		return
	}

	solved, msg, err := m.scenario.SolveInvestigation(input.Clues)
	if err != nil {
		sendError(s, e, "solve_failed", err.Error())
		return
	}

	state := m.scenario.GetState()
	if m.hub != nil {
		m.hub.Broadcast("game.state", state)
	} else {
		s.Send("game.state", e.RequestID, state)
	}

	s.Send("investigation.result", e.RequestID, map[string]any{
		"solved":  solved,
		"message": msg,
	})
}

// Stage 5: Relativistic experiment handlers
func (m *Module) experimentGet(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	if m.physics == nil {
		sendError(s, e, "physics_disabled", "Physics engine not initialized")
		return
	}
	s.Send("experiment.state", e.RequestID, m.physics.GetState())
}

func (m *Module) experimentUpdate(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input protocol.ExperimentUpdateRequest
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid experiment.update payload")
		return
	}

	if m.physics == nil {
		sendError(s, e, "physics_disabled", "Physics engine not initialized")
		return
	}

	updated, err := m.physics.UpdateExperiment(input.Velocity, input.Role, s.User().Username)
	if err != nil {
		sendError(s, e, "experiment_error", err.Error())
		return
	}

	// Broadcast updated physics experiment state to all participants
	if m.hub != nil {
		m.hub.Broadcast("experiment.state", updated)
	} else {
		s.Send("experiment.state", e.RequestID, updated)
	}
}

// Stage 6: Researcher Passport & Mistake Logging
func (m *Module) passportGet(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	ls, ok := m.players.(storage.LearningStore)
	if !ok {
		s.Send("passport.state", e.RequestID, storage.PassportRecord{
			UserID:          s.User().ID,
			MasteredTopics:  []string{"Выживание на орбите Юпитера"},
			CompletedQuests: []string{},
			ClearanceLevel:  "Исследователь",
		})
		return
	}

	passport, err := ls.GetPassport(ctx, s.User().ID)
	if err != nil {
		sendError(s, e, "passport_error", "Failed to retrieve passport")
		return
	}
	s.Send("passport.state", e.RequestID, passport)
}

func (m *Module) mistakeRecord(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input protocol.RecordMistakeRequest
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid learning.mistake.record payload")
		return
	}

	ls, ok := m.players.(storage.LearningStore)
	if !ok {
		sendError(s, e, "storage_disabled", "Learning store not available")
		return
	}

	err := ls.SaveMistake(ctx, storage.MistakeRecord{
		UserID:   s.User().ID,
		Topic:    input.Topic,
		Forecast: input.Forecast,
		Actual:   input.Actual,
	})
	if err != nil {
		sendError(s, e, "storage_error", err.Error())
		return
	}

	s.Send("learning.mistake.saved", e.RequestID, map[string]any{"status": "ok"})
}

// Stage 7: Historical Quest Validator (Separating citations from modern assumptions)
func (m *Module) herodotusQuestSubmit(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var input protocol.HistoryQuestSubmitRequest
	if err := protocol.DecodePayload(e.Payload, &input); err != nil {
		sendError(s, e, "invalid_payload", "Invalid quest.herodotus.submit payload")
		return
	}

	// Canonical ground truth per Stage 7 specification:
	// "quote" = authentic citation from Herodotus Book II (Euterpe)
	// "assumption" = modern myth/speculation
	groundTruth := map[string]string{
		"pyramids_machines":    "quote",
		"pyramids_powerplant":  "assumption",
		"labyrinth_rooms":      "quote",
		"alien_laser_cutting":  "assumption",
		"nile_summer_flood":    "quote",
		"underground_atlantis": "assumption",
	}

	score := 0
	total := len(groundTruth)
	feedback := make(map[string]bool)

	for cardID, expected := range groundTruth {
		given := input.Answers[cardID]
		isCorrect := given == expected
		feedback[cardID] = isCorrect
		if isCorrect {
			score++
		}
	}

	passed := score >= 5

	// Update passport if completed
	if passed {
		if ls, ok := m.players.(storage.LearningStore); ok {
			pass, _ := ls.GetPassport(ctx, s.User().ID)
			found := false
			for _, q := range pass.CompletedQuests {
				if q == "Геродот: Евтерпа" {
					found = true
					break
				}
			}
			if !found {
				pass.CompletedQuests = append(pass.CompletedQuests, "Геродот: Евтерпа")
				pass.MasteredTopics = append(pass.MasteredTopics, "Античные первоисточники Египта")
				pass.Score += 100
				pass.ClearanceLevel = "Старший историк-архивист"
				_ = ls.SavePassport(ctx, pass)
			}
		}
	}

	s.Send("quest.herodotus.result", e.RequestID, map[string]any{
		"score":    score,
		"total":    total,
		"passed":   passed,
		"feedback": feedback,
		"message": map[bool]string{
			true:  "Поздравляем! Вы безупречно отличили подлинные свидетельства Геродота от современных домыслов!",
			false: "Некоторые карточки определены неверно. Помните: Геродот опирался на свидетельства жрецов и деревянные машины, а не на фантастические домыслы!",
		}[passed],
	})
}

func (m *Module) leave(ctx context.Context, user model.User) {
	m.mu.Lock()
	state, exists := m.ready[user.ID]
	delete(m.ready, user.ID)
	m.mu.Unlock()

	if exists {
		if m.world != nil {
			if err := m.world.Leave(ctx, user.ID); err != nil {
				m.log.Error("world leave error", "player_id", user.ID, "error", err)
			}
		}
		if err := m.players.SavePlayer(ctx, state); err != nil {
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
