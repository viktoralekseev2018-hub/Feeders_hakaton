package game

import (
	"feeders/internal/model"
	"path/filepath"
	"testing"
)

func TestRealWorldBudgetsAcrossAllCells(t *testing.T) {
	m, store := roomFixture(t, t.TempDir())
	defer store.Close()
	if err := m.WithWorld(filepath.Join("..", "..", "world"), nil); err != nil {
		t.Fatal(err)
	}
	w := m.streamWorld
	if w.Bytes <= 0 || len(w.Chunks) < 4 {
		t.Fatal("empty world")
	}
	maxBytes := 0
	for x := -24.; x <= 24; x += 2 {
		for z := -24.; z <= 8; z += 2 {
			plan := m.planAt(model.Position{X: x, Y: 1.7, Z: z})
			seen := map[string]bool{}
			bytes := 0
			for _, r := range plan.Resources {
				if seen[r.ID] {
					t.Fatal("dependency counted twice")
				}
				seen[r.ID] = true
				bytes += r.Size
			}
			if bytes > plan.Budget || float64(bytes) > float64(w.Bytes)*.1 {
				t.Fatalf("budget exceeded at %g,%g: %d/%d", x, z, bytes, w.Bytes)
			}
			for _, chunk := range plan.Chunks {
				for _, id := range chunk.Deps {
					if !seen[id] {
						t.Fatal("missing admitted dependency", id)
					}
				}
			}
			if bytes > maxBytes {
				maxBytes = bytes
			}
		}
	}
	t.Logf("real world %d bytes; peak plan %d bytes (%.3f%%)", w.Bytes, maxBytes, float64(maxBytes)/float64(w.Bytes)*100)
}
