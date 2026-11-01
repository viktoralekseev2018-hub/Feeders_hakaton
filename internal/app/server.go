package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io/fs"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"feeders/internal/agents"
	"feeders/internal/auth"
	"feeders/internal/config"
	"feeders/internal/game"
	"feeders/internal/knowledge"
	"feeders/internal/npc"
	"feeders/internal/rag"
	"feeders/internal/realtime"
	"feeders/internal/server"
	"feeders/internal/storage"
	"feeders/web"
)

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	repo, err := storage.NewSQLiteStore(cfg.DataDir)
	if err != nil {
		return err
	}
	defer repo.Close()
	authHandler, err := auth.New(repo, cfg.SessionTTL, cfg.CookieSecure, log)
	if err != nil {
		return err
	}
	hub := realtime.New(authHandler, log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Этап 2 & 3 (Разработчик 2): 20Hz Tick Loop, валидация перемещений,
	// рассылка world.snapshot и периодическое автосохранение позиций игроков
	serverLoop := game.NewServerLoop(repo, hub, log)
	serverLoop.Start(ctx)
	defer serverLoop.Stop()

	persistence := game.NewPersistenceManager(repo, serverLoop, 2*time.Second, log)
	persistence.Start(ctx)
	defer persistence.Stop()

	// Этап 4 (Разработчик 2): AI Orchestrator с очередью запросов,
	// локальным клиентом Ollama и базой знаний первоисточников
	aiOrchestrator, err := agents.NewMentor(cfg.DataDir)
	if err != nil {
		return err
	}

	if err := aiOrchestrator.WithStore(repo); err != nil {
		return err
	}
	gameModule := game.New(repo, serverLoop, nil, log).WithCrewProjection(filepath.Join(cfg.DataDir, "crew-view.json"))
	if err := gameModule.WithPersistence(repo); err != nil {
		return err
	}
	serverLoop.ConfigureWorld(gameModule.RoomOf, gameModule.Walkable)
	if err := gameModule.WithWorld("world", authHandler); err != nil {
		return err
	}
	corpus, err := rag.Load(envOr("RAG_CHUNKS_FILE", "knowledge"))
	if err != nil {
		return err
	}
	local, err := npc.NewLocal(knowledge.Catalog{Store: corpus, ScenarioOverride: game.CallCrewTool}, envOr("OLLAMA_URL", "http://127.0.0.1:11434"), envOr("OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M"))
	if err != nil {
		return err
	}
	local.WithMission(gameModule)
	if err := local.WithMemory(repo); err != nil {
		return err
	}
	mcpBinary := os.Getenv("MCP_BINARY")
	var mcpArgs []string
	if mcpBinary == "" {
		mcpBinary, err = os.Executable()
		if err != nil {
			return err
		}
		mcpArgs = []string{"--mcp"}
	}
	local.WithMCP(mcpBinary, filepath.Join(cfg.DataDir, "crew-view.json"), envOr("RAG_CHUNKS_FILE", "knowledge"), mcpArgs...)
	if os.Getenv("OLLAMA_ENABLED") == "false" {
		local.WithoutModel()
	}
	log.Info("local crew model configured", "enabled", local.ModelEnabled(), "model", envOr("OLLAMA_MODEL", "qwen3:4b-instruct-2507-q4_K_M"), "endpoint", envOr("OLLAMA_URL", "http://127.0.0.1:11434"))
	gameModule.WithAgents(agents.NewCrewService(local, aiOrchestrator).WithMemory(repo))
	gameModule.Register(hub)

	var files fs.FS = web.Files
	if dir := os.Getenv("DEV_WEB_DIR"); dir != "" {
		files = os.DirFS(dir)
	}
	var capability [32]byte
	if _, err := rand.Read(capability[:]); err != nil {
		return err
	}
	worldKey := hex.EncodeToString(capability[:])
	gameModule.EnableWorldTools(worldKey)
	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           qaHandler(server.New(files, authHandler, hub, gameModule), authHandler),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}

	listener, err := net.Listen("tcp", cfg.Addr)
	if err != nil {
		return err
	}

	_, hostPort, _ := net.SplitHostPort(listener.Addr().String())
	local.WithWorldTools("http://127.0.0.1:"+hostPort, worldKey)
	errs := make(chan error, 1)
	go func() { errs <- httpServer.Serve(listener) }()
	log.Info("host ready", "address", listener.Addr(), "data_dir", cfg.DataDir, "protocol_version", 1, "world_enabled", true, "simulation_hz", 20, "ai_enabled", true)

	select {
	case <-ctx.Done():
	case err = <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Фиксация состояний игроков перед завершением
	persistence.Flush(shutdownCtx)

	// Закрытие WebSocket-соединений
	if closeErr := hub.Close(shutdownCtx); closeErr != nil {
		log.Error("websocket shutdown", "error", closeErr)
	}

	if closeErr := httpServer.Shutdown(shutdownCtx); closeErr != nil {
		_ = httpServer.Close()
		return closeErr
	}

	return err
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
