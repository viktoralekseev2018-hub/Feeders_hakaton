package physics

import (
	"math"
	"testing"
)

func TestCalculateGamma(t *testing.T) {
	tests := []struct {
		name     string
		v        float64
		expected float64
		epsilon  float64
	}{
		{"stationary v=0", 0.0, 1.0, 0.0001},
		{"relativistic v=0.6c", 0.6, 1.25, 0.0001},
		{"relativistic v=0.8c", 0.8, 1.6667, 0.0001},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gamma := CalculateGamma(tc.v)
			if math.Abs(gamma-tc.expected) > tc.epsilon {
				t.Errorf("CalculateGamma(%f) = %f; expected %f (epsilon %f)", tc.v, gamma, tc.expected, tc.epsilon)
			}
		})
	}
}

func TestEngineUpdateExperiment(t *testing.T) {
	eng := NewEngine()

	st := eng.GetState()
	if !st.Active {
		t.Errorf("expected engine active")
	}

	// Update to 0.8c
	updated, err := eng.UpdateExperiment(0.8, "station_observer", "player_alex")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if updated.Velocity != 0.8 {
		t.Errorf("expected velocity 0.8, got %f", updated.Velocity)
	}
	if math.Abs(updated.Gamma-1.6667) > 0.001 {
		t.Errorf("expected gamma ~1.6667, got %f", updated.Gamma)
	}
	if updated.StationObserver != "player_alex" {
		t.Errorf("expected station observer player_alex, got %s", updated.StationObserver)
	}

	// Invalid velocity (> 0.8)
	_, err = eng.UpdateExperiment(0.95, "", "")
	if err == nil {
		t.Errorf("expected error for velocity > 0.8c")
	}

	// Invalid role
	_, err = eng.UpdateExperiment(0.5, "invalid_role", "p1")
	if err == nil {
		t.Errorf("expected error for invalid role")
	}
}
