package agents

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"

	"feeders/internal/storage"
)

func TestKnowledgeRetrieval(t *testing.T) {
	// 1. Поиск для инженера
	art, found := FindKnowledge("engineer", "реактор охлаждение")
	if !found {
		t.Fatal("expected article to be found for engineer")
	}
	if art.AgentID != "engineer" {
		t.Fatalf("expected engineer article, got %s", art.AgentID)
	}

	// 2. Поиск для биолога
	artBio, foundBio := FindKnowledge("biologist", "растения хлорелла кислород")
	if !foundBio {
		t.Fatal("expected article to be found for biologist")
	}
	if artBio.AgentID != "biologist" {
		t.Fatalf("expected biologist article, got %s", artBio.AgentID)
	}

	// 3. Капитан видит темы энергобаланса
	artCap, foundCap := FindKnowledge("captain", "дилемма 20 МВт")
	if !foundCap {
		t.Fatal("expected article to be found for captain")
	}
	if artCap.AgentID != "captain" {
		t.Fatalf("expected captain article, got %s", artCap.AgentID)
	}

	// 4. АСТРА видит расследование аварии
	artAstra, foundAstra := FindKnowledge("astra", "авария метеорит")
	if !foundAstra {
		t.Fatal("expected article to be found for astra")
	}
	if artAstra.AgentID != "astra" {
		t.Fatalf("expected astra article, got %s", artAstra.AgentID)
	}

	// 5. Геродот (Stage 7)
	artHero, foundHero := FindKnowledge("herodotus", "пирамиды машины брусья")
	if !foundHero {
		t.Fatal("expected article to be found for herodotus")
	}
	if artHero.AgentID != "herodotus" {
		t.Fatalf("expected herodotus article, got %s", artHero.AgentID)
	}

	// 6. Эйнштейн (Stage 5-6)
	artEinstein, foundEinstein := FindKnowledge("einstein", "световые часы лоренц")
	if !foundEinstein {
		t.Fatal("expected article to be found for einstein")
	}
	if artEinstein.AgentID != "einstein" {
		t.Fatalf("expected einstein article, got %s", artEinstein.AgentID)
	}
}

func TestBuildAdaptivePromptAndPersonas(t *testing.T) {
	persona := Personas["einstein"]
	art, _ := FindKnowledge("einstein", "световые часы")
	mistakes := []string{"Игрок ожидал классическое сложение скоростей"}
	chips := []string{"explain_simpler", "give_analogy"}
	prompt := BuildAdaptivePrompt(persona, art, "Как идут часы на скорости 0.8c?", []string{"Приветствие"}, mistakes, chips)

	if !strings.Contains(prompt, "ИСТОРИЯ ОШИБОК ИГРОКА") {
		t.Errorf("expected prompt to contain mistake history")
	}
	if !strings.Contains(prompt, "ОБЪЯСНИ ПРОЩЕ") {
		t.Errorf("expected prompt to contain simpler chip")
	}
	if !strings.Contains(prompt, "БЫТОВОЙ ПРИМЕР") {
		t.Errorf("expected prompt to contain analogy chip")
	}
}

func TestOrchestratorAdaptiveMemoryAndHerodotus(t *testing.T) {
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	orch := NewOrchestrator("http://127.0.0.1:54321", "test-model", log)

	dir := t.TempDir()
	store, err := storage.NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	orch.SetLearningStore(store)

	ctx := context.Background()

	// 1. Проверяем Геродота
	heroReply, err := orch.Talk(ctx, Request{
		PlayerID: "player-history",
		AgentID:  "herodotus",
		Text:     "Расскажи о Лабиринте и пирамидах",
	})
	if err != nil {
		t.Fatalf("herodotus talk failed: %v", err)
	}
	if heroReply.AgentID != "herodotus" || !strings.Contains(heroReply.Text, "Евтерпа") && !strings.Contains(heroReply.Text, "Геродот") && !strings.Contains(heroReply.Text, "истори") {
		t.Fatalf("invalid herodotus reply: %+v", heroReply)
	}

	// 2. Добавляем ошибку в историю обучения
	_ = store.SaveMistake(ctx, storage.MistakeRecord{
		UserID:   "player-relativity",
		Topic:    "time_dilation",
		Forecast: "Световые часы в ракете идут с той же скоростью",
		Actual:   "Фактор Лоренца gamma=1.6667 при 0.8c",
	})

	// 3. Эйнштейн отвечает с учетом ошибки
	einsteinReply, err := orch.Talk(ctx, Request{
		PlayerID: "player-relativity",
		AgentID:  "einstein",
		Text:     "Объясни проще на бытовом примере",
	})
	if err != nil {
		t.Fatalf("einstein talk failed: %v", err)
	}
	if !strings.Contains(einsteinReply.Text, "прогноз") && !strings.Contains(einsteinReply.Text, "вагон") && !strings.Contains(einsteinReply.Text, "поезд") {
		t.Fatalf("expected adaptive reply with analogy or past mistake reference, got: %s", einsteinReply.Text)
	}

	// 4. Параллельные запросы без race conditions
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, _ = orch.Talk(ctx, Request{
				PlayerID: "p1",
				AgentID:  "herodotus",
				Text:     "Кто строил пирамиды?",
			})
		}(i)
	}
	wg.Wait()
}
