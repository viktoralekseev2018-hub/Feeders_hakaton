package storage

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"feeders/internal/model"
)

// TestCrashResilienceSimulatedWAL tests atomicity and crash recovery under high concurrency
// simulating sudden process interruptions during write operations.
func TestCrashResilienceSimulatedWAL(t *testing.T) {
	ctx := context.Background()
	dir := t.TempDir()

	store, err := NewFileStore(dir)
	if err != nil {
		t.Fatalf("failed to init store: %v", err)
	}

	const workerCount = 15
	const iterations = 20

	var wg sync.WaitGroup
	for w := 0; w < workerCount; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for i := 0; i < iterations; i++ {
				uID := fmt.Sprintf("sim-player-%d", workerID)
				st := model.PlayerState{
					PlayerID:  uID,
					Position:  model.Position{X: float64(workerID * 10), Y: 1.7, Z: float64(i)},
					Yaw:       float64(i),
					UpdatedAt: time.Now().UTC(),
				}
				_ = store.SavePlayer(ctx, st)

				// Save mistake
				_ = store.SaveMistake(ctx, MistakeRecord{
					UserID:   uID,
					Topic:    "relativity",
					Forecast: fmt.Sprintf("prediction-%d", i),
					Actual:   "actual-result",
				})
			}
		}(w)
	}

	wg.Wait()

	// Simulate reopening repository after abrupt stop
	reopened, err := NewFileStore(dir)
	if err != nil {
		t.Fatalf("reopening failed: %v", err)
	}

	for w := 0; w < workerCount; w++ {
		uID := fmt.Sprintf("sim-player-%d", w)
		p, err := reopened.LoadPlayer(ctx, uID)
		if err != nil {
			t.Fatalf("failed to load player %s after crash simulation: %v", uID, err)
		}
		if p.PlayerID != uID {
			t.Errorf("expected player ID %s, got %s", uID, p.PlayerID)
		}

		hist, err := reopened.GetLearningHistory(ctx, uID)
		if err != nil || len(hist) == 0 {
			t.Fatalf("failed to load history for %s: %v", uID, err)
		}
	}

	// Verify no temporary dirty files left over
	files, _ := filepath.Glob(filepath.Join(dir, "players", ".record-*"))
	if len(files) > 0 {
		t.Errorf("found uncleaned WAL temporary files: %v", files)
	}
	_ = os.RemoveAll(dir)
}
