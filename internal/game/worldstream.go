package game

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"feeders/internal/auth"
	"feeders/internal/model"
	"feeders/internal/realtime"
	"feeders/internal/server"
	"feeders/pkg/protocol"
	"fmt"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
)

type WorldResource struct {
	ID   string `json:"id"`
	Size int    `json:"size"`
	Hash string `json:"hash"`
	Kind string `json:"kind"`
}
type WorldLOD struct {
	Object string   `json:"object"`
	Deps   []string `json:"deps"`
}
type WorldChunk struct {
	NPC  string   `json:"npc,omitempty"`
	CX   int      `json:"cx"`
	CZ   int      `json:"cz"`
	Low  WorldLOD `json:"low"`
	High WorldLOD `json:"high"`
}
type WorldRoom struct {
	ID   string  `json:"id"`
	X    float64 `json:"x"`
	Z    float64 `json:"z"`
	W    float64 `json:"w"`
	D    float64 `json:"d"`
	Name string  `json:"name"`
}
type StreamWorld struct {
	Version    string          `json:"version"`
	ChunkSize  int             `json:"chunk_size"`
	Bytes      int             `json:"world_bytes"`
	Resources  []WorldResource `json:"resources"`
	Chunks     []WorldChunk    `json:"chunks"`
	Background WorldLOD        `json:"background"`
	Rooms      []WorldRoom     `json:"rooms"`
	dir        string
	byID       map[string]WorldResource
	auth       *auth.Handler
}
type WorldPlan struct {
	Version    string          `json:"version"`
	WorldBytes int             `json:"world_bytes"`
	Budget     int             `json:"budget"`
	Resources  []WorldResource `json:"resources"`
	Chunks     []WorldLOD      `json:"chunks"`
	Background WorldLOD        `json:"background"`
	Position   model.Position  `json:"position"`
}

func (m *Module) WithWorld(dir string, a *auth.Handler) error {
	b, e := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if e != nil {
		return e
	}
	w := &StreamWorld{dir: dir, auth: a, byID: map[string]WorldResource{}}
	if e = json.Unmarshal(b, w); e != nil {
		return e
	}
	total := 0
	for _, r := range w.Resources {
		if !regexp.MustCompile(`^[a-z]+_[a-f0-9]{24}$`).MatchString(r.ID) {
			return fmt.Errorf("invalid resource ID")
		}
		b, e = os.ReadFile(filepath.Join(dir, r.ID+".json"))
		if e != nil {
			return e
		}
		sum := sha256.Sum256(b)
		if len(b) != r.Size || hex.EncodeToString(sum[:]) != r.Hash {
			return fmt.Errorf("world resource failed validation: %s", r.ID)
		}
		if _, exists := w.byID[r.ID]; exists {
			return fmt.Errorf("duplicate world resource")
		}
		w.byID[r.ID] = r
		total += r.Size
	}
	if total != w.Bytes || w.ChunkSize <= 0 {
		return fmt.Errorf("world manifest size mismatch")
	}
	m.streamWorld = w
	return nil
}
func (m *Module) RegisterRoutes(mux *http.ServeMux) {
	if m.streamWorld == nil {
		return
	}
	m.registerExperimentHTTP(mux)
	w := m.streamWorld
	resolve := func(writer http.ResponseWriter, r *http.Request) (string, bool) {
		u, ok := w.auth.Resolve(r)
		if !ok {
			server.JSON(writer, 401, map[string]string{"message": "Войдите в аккаунт"})
			return "", false
		}
		return u.ID, true
	}
	mux.HandleFunc("GET /api/world/meta", func(out http.ResponseWriter, r *http.Request) {
		if _, ok := resolve(out, r); !ok {
			return
		}
		server.JSON(out, 200, map[string]any{"version": w.Version, "world_bytes": w.Bytes, "budget": int(float64(w.Bytes) * .08), "limit": int(float64(w.Bytes) * .1), "chunk_size": w.ChunkSize, "rooms": w.Rooms})
	})
	mux.HandleFunc("GET /api/world/interest", func(out http.ResponseWriter, r *http.Request) {
		id, ok := resolve(out, r)
		if !ok {
			return
		}
		server.JSON(out, 200, m.worldPlan(id))
	})
	mux.HandleFunc("GET /api/world/resource/{id}", func(out http.ResponseWriter, r *http.Request) {
		id, ok := resolve(out, r)
		if !ok {
			return
		}
		requested := r.PathValue("id")
		plan := m.worldPlan(id)
		allowed := false
		for _, v := range plan.Resources {
			if v.ID == requested {
				allowed = true
				break
			}
		}
		if !allowed {
			server.JSON(out, 403, map[string]string{"message": "Ресурс вне разрешённой области"})
			return
		}
		out.Header().Set("Content-Type", "application/json")
		out.Header().Set("Cache-Control", "no-store")
		http.ServeFile(out, r, filepath.Join(w.dir, requested+".json"))
	})
}
func (m *Module) worldPosition(id string) model.Position {
	if w, ok := m.world.(interface{ GetAllPlayersStates() []model.PlayerState }); ok {
		for _, p := range w.GetAllPlayersStates() {
			if p.PlayerID == id {
				return p.Position
			}
		}
	}
	return model.Position{X: -15, Y: 1.7, Z: 0}
}
func (m *Module) worldPlan(id string) WorldPlan {
	p := m.worldPosition(id)
	return m.planAt(p)
}
func (m *Module) planAt(p model.Position) WorldPlan {
	w := m.streamWorld
	plan := WorldPlan{Version: w.Version, WorldBytes: w.Bytes, Budget: int(float64(w.Bytes) * .08), Background: w.Background, Position: p, Resources: []WorldResource{}, Chunks: []WorldLOD{}}
	used := map[string]bool{}
	bytes := 0
	add := func(lod WorldLOD) bool {
		extra := 0
		for _, id := range lod.Deps {
			if !used[id] {
				extra += w.byID[id].Size
			}
		}
		if bytes+extra > plan.Budget {
			return false
		}
		for _, id := range lod.Deps {
			if !used[id] {
				used[id] = true
				plan.Resources = append(plan.Resources, w.byID[id])
			}
		}
		bytes += extra
		return true
	}
	add(w.Background)
	cx, cz := int(math.Floor(p.X/float64(w.ChunkSize))), int(math.Floor(p.Z/float64(w.ChunkSize)))
	near := []WorldChunk{}
	for _, c := range w.Chunks {
		if abs(c.CX-cx) <= 1 && abs(c.CZ-cz) <= 1 {
			near = append(near, c)
		}
	}
	sort.Slice(near, func(i, j int) bool {
		di, dj := abs(near[i].CX-cx)+abs(near[i].CZ-cz), abs(near[j].CX-cx)+abs(near[j].CZ-cz)
		if di == dj {
			if near[i].NPC != "" && near[j].NPC == "" {
				return true
			}
			if near[j].NPC != "" && near[i].NPC == "" {
				return false
			}
			if near[i].CX == near[j].CX {
				return near[i].CZ < near[j].CZ
			}
			return near[i].CX < near[j].CX
		}
		return di < dj
	})
	// Admit all useful low-detail neighbours before spending spare budget on detail.
	for i, c := range near {
		if i == 0 && add(c.High) {
			plan.Chunks = append(plan.Chunks, c.High)
		} else if add(c.Low) {
			plan.Chunks = append(plan.Chunks, c.Low)
		}
	}
	return plan
}
func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
func (m *Module) teleport(ctx context.Context, s realtime.Session, e protocol.Envelope) {
	var p struct {
		Target string `json:"target"`
	}
	if protocol.DecodePayload(e.Payload, &p) != nil || !m.isReady(s.User().ID) || m.RoomOf(s.User().ID) == "" {
		sendError(s, e, "invalid_target", "Выберите допустимую точку корабля")
		return
	}
	targets := map[string]model.Position{"cryo": {X: -15, Y: 1.7, Z: 0}, "bridge": {X: 0, Y: 1.7, Z: 2}, "reactor": {X: 12, Y: 1.7, Z: 2}, "bio": {X: -4, Y: 1.7, Z: -14}, "savinykh": {X: 4.2, Y: 1.7, Z: -.5}, "dzhanibekov": {X: 12, Y: 1.7, Z: 3}, "ryazansky": {X: -4, Y: 1.7, Z: -14}, "krikalev": {X: -5, Y: 1.7, Z: -.5}}
	pos, ok := targets[p.Target]
	if !ok {
		sendError(s, e, "invalid_target", "Неизвестная точка корабля")
		return
	}
	loop, ok := m.world.(*ServerLoop)
	if !ok {
		sendError(s, e, "unavailable", "Перемещение недоступно")
		return
	}
	loop.mu.Lock()
	live := loop.players[s.User().ID]
	if live == nil {
		loop.mu.Unlock()
		return
	}
	live.Position = pos
	live.Dirty = true
	state := model.PlayerState{PlayerID: live.User.ID, Position: pos, Yaw: live.Yaw, LastSeq: live.LastSeq}
	loop.mu.Unlock()
	if err := m.players.SavePlayer(ctx, state); err != nil {
		m.failure(s, e, err)
		return
	}
	s.Send("player.position", e.RequestID, state)
}

func (m *Module) Walkable(x, z float64) bool {
	if m.streamWorld == nil {
		return true
	}
	floor := (math.Abs(z) < 3 && x > -22 && x < 23) || (math.Abs(x) < 3 && z > -22 && z < 5)
	for _, r := range m.streamWorld.Rooms {
		if math.Abs(x-r.X) < r.W/2-.3 && math.Abs(z-r.Z) < r.D/2-.3 {
			floor = true
		}
	}
	return floor && math.Hypot(x-17, z) >= 2.65 && !(math.Abs(x) < 2.8 && math.Abs(z+2) < 1.65)
}
