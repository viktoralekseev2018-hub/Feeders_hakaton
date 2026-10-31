// Package physics implements relativistic physics simulations for ChronoGrad.
// Stage 5: Lorentz time dilation and light-clock experiment calculations.
package physics

import (
	"errors"
	"math"
	"sync"
	"time"
)

var (
	ErrVelocityOutOfBounds = errors.New("velocity must be between 0.0 and 0.8c")
	ErrInvalidRole         = errors.New("invalid experiment role: must be station_observer or lab_observer")
)

// ExperimentState holds the live state of the relativistic light-clock experiment.
type ExperimentState struct {
	Active          bool    `json:"active"`
	Velocity        float64 `json:"velocity"`          // in fractions of c (0.0 .. 0.8)
	Gamma           float64 `json:"gamma"`             // Lorentz factor gamma = 1 / sqrt(1 - v^2)
	StationObserver string  `json:"station_observer"` // Player ID or name on moving station
	LabObserver     string  `json:"lab_observer"`     // Player ID or name in stationary lab
	TimeDilationPct float64 `json:"time_dilation_pct"` // (gamma - 1) * 100
	PhotonBounces   int64   `json:"photon_bounces"`   // Total simulated photon reflections
	UpdatedAt       int64   `json:"updated_at"`       // Unix timestamp ms
}

// Engine manages the shared relativistic light clock simulation.
type Engine struct {
	mu    sync.RWMutex
	state ExperimentState
}

// NewEngine creates a new physics engine initialized at v = 0.6c (canonical gamma = 1.25).
func NewEngine() *Engine {
	gamma := CalculateGamma(0.6)
	return &Engine{
		state: ExperimentState{
			Active:          true,
			Velocity:        0.6,
			Gamma:           gamma,
			StationObserver: "Марк Вэнс (Станция)",
			LabObserver:     "Исследователь (Лаборатория)",
			TimeDilationPct: (gamma - 1.0) * 100.0,
			PhotonBounces:   0,
			UpdatedAt:       time.Now().UnixMilli(),
		},
	}
}

// CalculateGamma computes the relativistic Lorentz factor: gamma = 1 / sqrt(1 - v^2/c^2).
// Precision test cases from specification:
// v = 0.6c -> gamma = 1.2500
// v = 0.8c -> gamma = 1.6667
func CalculateGamma(v float64) float64 {
	if v <= 0.0 {
		return 1.0
	}
	if v > 0.8 {
		v = 0.8
	}
	return 1.0 / math.Sqrt(1.0-v*v)
}

// GetState returns a thread-safe copy of the current experiment state.
func (e *Engine) GetState() ExperimentState {
	e.mu.RLock()
	defer e.mu.RUnlock()
	return e.state
}

// UpdateExperiment modifies the simulation parameters (velocity and participant roles).
func (e *Engine) UpdateExperiment(velocity float64, role, playerID string) (*ExperimentState, error) {
	if velocity < 0.0 || velocity > 0.80001 {
		return nil, ErrVelocityOutOfBounds
	}
	if role != "" && role != "station_observer" && role != "lab_observer" {
		return nil, ErrInvalidRole
	}

	e.mu.Lock()
	defer e.mu.Unlock()

	gamma := CalculateGamma(velocity)
	e.state.Velocity = velocity
	e.state.Gamma = math.Round(gamma*10000) / 10000 // 4 decimal places
	e.state.TimeDilationPct = math.Round((gamma-1.0)*1000) / 10.0
	e.state.UpdatedAt = time.Now().UnixMilli()

	if role == "station_observer" && playerID != "" {
		e.state.StationObserver = playerID
	} else if role == "lab_observer" && playerID != "" {
		e.state.LabObserver = playerID
	}

	return &e.state, nil
}
