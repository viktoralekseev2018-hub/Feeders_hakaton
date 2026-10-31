package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"feeders/internal/agents"
	"feeders/internal/auth"
	"feeders/internal/config"
	"feeders/internal/game"
	"feeders/internal/realtime"
	"feeders/internal/server"
	"feeders/internal/storage"
	"feeders/web"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, nil))
	if err := run(log); err != nil {
		log.Error("host stopped", "error", err)
		os.Exit(1)
	}
}

func run(log *slog.Logger) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	repo, err := storage.NewFileStore(cfg.DataDir)
	if err != nil {
		return err
	}
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

	persistence := game.NewPersistenceManager(repo, serverLoop, 5*time.Second, log)
	persistence.Start(ctx)
	defer persistence.Stop()

	// Этап 4 (Разработчик 2): AI Orchestrator с очередью запросов,
	// локальным клиентом Ollama и базой знаний первоисточников
	aiOrchestrator := agents.NewOrchestrator("", "", log)

	gameModule := game.New(repo, serverLoop, aiOrchestrator, log)
	gameModule.Register(hub)

	httpServer := &http.Server{
		Addr:              cfg.Addr,
		Handler:           server.New(web.Files, authHandler, hub),
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
