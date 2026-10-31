// Package agents - orchestrator.go
// Этап 4, 6 и 7 для Разработчика 2 (AI Orchestrator):
// - Ограниченная FIFO очередь запросов (1 активная генерация, до 8 в очереди)
// - Ollama HTTP-клиент с защитой по таймауту
// - Оффлайн-fallback RAG с цитированием первоисточников
// - Адаптивная память бесед с предотвращением повторений и учетом ошибок игрока (Stage 6)
// - Роутер персон: капитан, инженер, биолог, АСТРА, Геродот, Эйнштейн (Stage 7)
package agents

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"feeders/internal/storage"
)

type Orchestrator struct {
	ollamaURL     string
	modelName     string
	httpClient    *http.Client
	log           *slog.Logger
	queueSem      chan struct{} // Семафор 1 активная генерация
	historyMu     sync.RWMutex
	conversations map[string][]string // ключ: playerID + ":" + agentID -> последние 4 реплики
	learningStore storage.LearningStore
}

func NewOrchestrator(ollamaURL, modelName string, log *slog.Logger) *Orchestrator {
	if log == nil {
		log = slog.Default()
	}
	if ollamaURL == "" {
		ollamaURL = os.Getenv("OLLAMA_URL")
		if ollamaURL == "" {
			ollamaURL = "http://localhost:11434"
		}
	}
	if modelName == "" {
		modelName = os.Getenv("OLLAMA_MODEL")
		if modelName == "" {
			modelName = "qwen2.5:3b"
		}
	}

	return &Orchestrator{
		ollamaURL:     ollamaURL,
		modelName:     modelName,
		httpClient:    &http.Client{Timeout: 12 * time.Second},
		log:           log,
		queueSem:      make(chan struct{}, 1), // По ТЗ: ровно 1 активный запрос на генерацию
		conversations: make(map[string][]string),
	}
}

// SetLearningStore подключает репозиторий ошибок игрока для адаптивного промпта (Stage 6).
func (o *Orchestrator) SetLearningStore(store storage.LearningStore) {
	o.learningStore = store
}

// Talk обрабатывает диалоговый запрос игрока к ИИ-члену экипажа или исторической персоне.
func (o *Orchestrator) Talk(ctx context.Context, req Request) (Reply, error) {
	persona, ok := Personas[req.AgentID]
	if !ok {
		// Дефолт к Капитану
		persona = Personas["captain"]
	}

	// 1. Поиск релевантного источника из базы знаний станции (RAG)
	article, _ := FindKnowledge(persona.ID, req.Text)

	// 2. Получение истории прошлых реплик игрока с этим агентом (потокобезопасная копия)
	convKey := req.PlayerID + ":" + persona.ID
	o.historyMu.RLock()
	var priorHistory []string
	if rawHistory, exists := o.conversations[convKey]; exists && len(rawHistory) > 0 {
		priorHistory = make([]string, len(rawHistory))
		copy(priorHistory, rawHistory)
	}
	o.historyMu.RUnlock()

	// 3. Сборка истории ошибок игрока (Stage 6 Adaptive Prompt)
	var mistakeNotes []string
	if o.learningStore != nil {
		if hist, err := o.learningStore.GetLearningHistory(ctx, req.PlayerID); err == nil && len(hist) > 0 {
			for _, m := range hist {
				mistakeNotes = append(mistakeNotes, fmt.Sprintf("Тема: %s; Прогноз игрока: «%s»; Реальный факт: «%s»", m.Topic, m.Forecast, m.Actual))
			}
		}
	}

	// 4. Определение чипов обратной связи
	var chips []string
	lowerText := strings.ToLower(req.Text)
	if strings.Contains(lowerText, "проще") || strings.Contains(lowerText, "simpler") {
		chips = append(chips, "explain_simpler")
	}
	if strings.Contains(lowerText, "пример") || strings.Contains(lowerText, "analogy") || strings.Contains(lowerText, "бытовой") {
		chips = append(chips, "give_analogy")
	}

	// 5. Сборка системного промпта с цитатой первоисточника и адаптацией
	fullPrompt := BuildAdaptivePrompt(persona, article, req.Text, priorHistory, mistakeNotes, chips)

	// 6. Попытка запроса в локальную модель Ollama через очередь
	replyText, usedOllama := o.tryOllamaGeneration(ctx, fullPrompt)

	// Если Ollama недоступна (или оффлайн на хакатоне), генерируем точный доменный fallback
	if !usedOllama {
		replyText = o.generateDomainFallback(persona, article, req.Text, mistakeNotes)
	}

	// 7. Обновление контекста истории
	o.historyMu.Lock()
	o.conversations[convKey] = append(o.conversations[convKey], req.Text, replyText)
	if len(o.conversations[convKey]) > 6 {
		o.conversations[convKey] = o.conversations[convKey][len(o.conversations[convKey])-6:]
	}
	o.historyMu.Unlock()

	confidence := "offline-rag"
	if usedOllama {
		confidence = "ollama-verified"
	}

	return Reply{
		AgentID:   persona.ID,
		AgentName: persona.Name,
		Text:      replyText,
		Citation: &Citation{
			SourceTitle: article.Title,
			Section:     article.Section,
			Excerpt:     article.Summary,
			Confidence:  confidence,
		},
	}, nil
}

func (o *Orchestrator) tryOllamaGeneration(ctx context.Context, prompt string) (string, bool) {
	// Попытка войти в ограниченную очередь с таймаутом
	select {
	case o.queueSem <- struct{}{}:
		defer func() { <-o.queueSem }()
	case <-ctx.Done():
		return "", false
	case <-time.After(2500 * time.Millisecond):
		o.log.Warn("ollama queue saturated, falling back to local domain rag")
		return "", false
	}

	type OllamaReq struct {
		Model  string `json:"model"`
		Prompt string `json:"prompt"`
		Stream bool   `json:"stream"`
	}

	reqBody, _ := json.Marshal(OllamaReq{
		Model:  o.modelName,
		Prompt: prompt,
		Stream: false,
	})

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, o.ollamaURL+"/api/generate", bytes.NewReader(reqBody))
	if err != nil {
		return "", false
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := o.httpClient.Do(httpReq)
	if err != nil {
		return "", false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", false
	}

	var res struct {
		Response string `json:"response"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil || len(res.Response) == 0 {
		return "", false
	}

	return res.Response, true
}

// generateDomainFallback формирует адаптивный научно обоснованный ответ в рамках роли.
func (o *Orchestrator) generateDomainFallback(persona AgentPersona, article KnowledgeArticle, userQ string, mistakes []string) string {
	lowerQ := strings.ToLower(userQ)
	isSimpler := strings.Contains(lowerQ, "проще")
	isAnalogy := strings.Contains(lowerQ, "пример")

	switch persona.ID {
	case "engineer":
		if isSimpler {
			return fmt.Sprintf("Простыми словами: реактору нужно 15 МВт, а оранжерее 12 МВт. У нас всего 20 МВт! Если включим импульсы дейтерия 2 Гц, реактор возьмет только 9 МВт. Мы спасены!")
		}
		return fmt.Sprintf("Слушай цифры: согласно %s, нам нужно 15 МВт для удержания плазмы. Но если мы синхронизируемся с биологом и включим импульсную продувку дейтерия на частоте 2 Гц — мы снизим аппетит реактора до 9 МВт! Физика на нашей стороне, доложи капитану!", article.Section)

	case "biologist":
		if isSimpler {
			return fmt.Sprintf("Если выключить тепло, микроводоросли погибнут за 3 часа при +8.5°C. Но если дать им фиолетовый ночной свет 430 нм — хватит всего 5 МВт вместо 12 МВт!")
		}
		return fmt.Sprintf("Я не могу рисковать нашими культурами. Как сказано в %s, при температуре ниже +8.5°C хлорелла погибнет за 3 часа. Однако если мы перейдём на ночной спектр 430 нм, оранжерее хватит 5 МВт. Это наш единственный шанс сберечь воздух!", article.Section)

	case "captain":
		return fmt.Sprintf("Внимание, исследователь. В бортовом журнале чётко зафиксировано: у нас есть ровно 20 МВт. 15 МВт (Марк) + 12 МВт (Елена) = 27 МВт — мы обречены, если будем спорить. Твоя задача: объединить их на импульсном реакторе (9 МВт) и ночном биокуполе (5 МВт). Это 14 МВт плюс 4 МВт на станцию = 18 МВт. Это наше спасение!")

	case "astra":
		return fmt.Sprintf("АСТРА: Внимание экипаж. Анализ состояния систем корабля («Горизонт-7»): Ограничение — 8 циклов. Согласно %s, повреждение контура охлаждения инициировало защитный протокол. Сохраняйте баланс O2 и энергии, восстановите архив для подтверждения причин аварии.", article.Section)

	case "herodotus":
		if isAnalogy {
			return fmt.Sprintf("О досточтимый путник! Я — Геродот Галикарнасский. Представь мореплавателя, что заплыл в незнакомую гавань. Поверит ли он сказкам трактирщика о морских змеях или поверит лишь тому, что сам измерил лотом? Так и во второй книге «Истории» («Евтерпа», %s): я пишу лишь то, что зрел очами или слышал непосредственно от жрецов Гелиополя!", article.Section)
		}
		return fmt.Sprintf("Приветствую тебя, любознательный эллин! Я — Геродот Галикарнасский. Во второй книге «Истории» («Евтерпа», %s) записано: «%s». Истинный исследователь древности обязан строго отделять подлинное свидетельство очевидца от позднейших домыслов!", article.Section, article.Summary)

	case "einstein":
		prefix := ""
		if len(mistakes) > 0 {
			prefix = "Помните ваш предыдущий прогноз? Вы предположили, что времена совпадут или скорости просто сложатся. Однако в релятивистском мире это не так! "
		}
		if isAnalogy {
			return prefix + "Представьте зеркальный вагончик, мчащийся со скоростью 0.8c. Внутри вагона световой зайчик просто скачет вверх-вниз по вертикали. Но с перрона станции его траектория вытягивается в длинный зигзаг! А поскольку скорость света c неизменна, зайчику требуется больше времени. Так и замедляется ход времени!"
		}
		if isSimpler {
			return prefix + "Всё дело в том, что свет никого не догоняет и не ждёт — его скорость c всегда постоянна! Чтобы свет успел пробежать между движущимися зеркалами, само время внутри обязано замедлиться. При 0.6c — на 25%, а при 0.8c — на 66.7%!"
		}
		return prefix + fmt.Sprintf("Согласно %s: скорость света c инвариантна для любого наблюдателя. Из-за этого при субсветовой скорости v = 0.6c фактор Лоренца равен 1.25, а при v = 0.8c равен 1.6667. Запустите релятивистские световые часы на панели лаборатории и убедитесь в этом сами!", article.Section)

	default:
		return fmt.Sprintf("Информация из %s: %s", article.Title, article.Summary)
	}
}

// ResetHistory очищает историю диалогов игрока.
func (o *Orchestrator) ResetHistory(playerID, agentID string) {
	o.historyMu.Lock()
	defer o.historyMu.Unlock()
	delete(o.conversations, playerID+":"+agentID)
}

// SetModel позволяет переключать локальную модель.
func (o *Orchestrator) SetModel(modelName string) {
	o.modelName = modelName
}
