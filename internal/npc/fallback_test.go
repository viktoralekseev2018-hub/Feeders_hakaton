package npc

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"feeders/internal/knowledge"
	"feeders/internal/mission"
	"feeders/internal/rag"
)

func TestScenarioModelUsesReadOnlyPlanTool(t *testing.T) {
	store, _ := rag.Load("../../knowledge")
	m, _ := mission.New("")
	_, _ = m.Create(context.Background(), "p", 1, nil)
	var calls atomic.Int32
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			_, _ = w.Write([]byte(`{"message":{"role":"assistant","tool_calls":[{"function":{"name":"savinykh_rescue_plans","arguments":{}}}]}}`))
			return
		}
		_, _ = w.Write([]byte(`{"message":{"role":"assistant","content":"Комбинированный план [scenario-combined-plan]"}}`))
	}))
	defer h.Close()
	s, _ := NewLocal(knowledge.Catalog{Store: store}, h.URL, "qwen")
	s.WithMission(m)
	reply, err := s.Talk(context.Background(), Request{"", "p", mission.Captain, "Комбинированный план"})
	if err != nil || reply.Mode != "model" || calls.Load() != 2 {
		t.Fatal(reply, err, calls.Load())
	}
	v, _ := m.View("p")
	if v.State.Cycle != 0 || v.State.E != 35 {
		t.Fatal("model tool mutated mission", v)
	}
}

func TestExtractiveGuardPreservesWholeSentencesAndNegation(t *testing.T) {
	e := []rag.Chunk{{ID: "x", Text: "Это не доказывает, что растения вызвали перегрев."}}
	if extractive("растения вызвали перегрев [x]", e) {
		t.Fatal("partial sentence dropped the negation")
	}
	if !extractive("Это не доказывает, что растения вызвали перегрев. [x]", e) {
		t.Fatal("supported sentence rejected")
	}
}

func TestFourAgentsAnswerOfflineFromScenario(t *testing.T) {
	store, err := rag.Load("../../knowledge")
	if err != nil {
		t.Fatal(err)
	}
	m, _ := mission.New("")
	_, _ = m.Create(context.Background(), "p", 1, nil)
	s, _ := NewLocal(knowledge.Catalog{Store: store}, "http://127.0.0.1:1", "qwen3:8b")
	s.WithMission(m).WithoutModel()
	for _, r := range []Request{{"", "p", mission.Captain, "Как выбрать комбинированный план спасения?"}, {"", "p", mission.Engineer, "Как восстановить охлаждение реактора?"}, {"", "p", mission.Biologist, "Что известно про инфекцию и пробу?"}, {"", "p", mission.Navigator, "Как восстановить архив и подготовить курс?"}} {
		reply, err := s.Talk(context.Background(), r)
		if err != nil || reply.Mode != "knowledge_base" || reply.Analysis == nil || reply.MissionVersion != 1 || len(reply.Evidence) == 0 {
			t.Fatal(r, reply, err)
		}
		for _, c := range reply.Evidence {
			if c.ID == "scenario-confirmed-cause" || c.ID == "scenario-drone-route" {
				t.Fatal("spoiler", c)
			}
		}
	}
}
func TestUnverifiedModelTextFallsBackWithoutSpoilers(t *testing.T) {
	store, _ := rag.Load("../../knowledge")
	m, _ := mission.New("")
	_, _ = m.Create(context.Background(), "p", 1, nil)
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"message":{"role":"assistant","content":"Виноват микрометеорит. [scenario-briefing]"}}`))
	}))
	defer h.Close()
	s, _ := NewLocal(knowledge.Catalog{Store: store}, h.URL, "qwen")
	s.WithMission(m)
	reply, err := s.Talk(context.Background(), Request{"", "p", mission.Captain, "Почему произошла авария?"})
	if err != nil || reply.Mode != "knowledge_base" || strings.Contains(reply.Text, "микрометеорит") {
		t.Fatal(reply, err)
	}
}
func TestTimeoutReturnsKnowledgeAndParentCancellationStillCancels(t *testing.T) {
	stop := make(chan struct{})
	h := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { <-stop }))
	defer h.Close()
	defer close(stop)
	s, _ := NewLocal(catalog(t, false), h.URL, "qwen")
	s.client.Timeout = 30 * time.Millisecond
	start := time.Now()
	reply, err := s.Talk(context.Background(), Request{"", "p", "dzhanibekov", "Питание"})
	if err != nil || reply.Mode != "knowledge_base" || time.Since(start) > time.Second {
		t.Fatal(reply, err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err = s.Talk(ctx, Request{"", "p", "dzhanibekov", "Питание"}); err == nil {
		t.Fatal("parent cancellation ignored")
	}
}
