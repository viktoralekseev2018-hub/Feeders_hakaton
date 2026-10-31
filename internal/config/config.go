package config

import (
	"fmt"
	"net"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Addr         string
	DataDir      string
	SessionTTL   time.Duration
	CookieSecure bool
}

func Load() (Config, error) {
	c := Config{Addr: env("HOST_ADDR", "0.0.0.0:8080"), DataDir: env("DATA_DIR", "data"), SessionTTL: 12 * time.Hour}
	if _, _, err := net.SplitHostPort(c.Addr); err != nil {
		return c, fmt.Errorf("HOST_ADDR: %w", err)
	}
	var err error
	c.SessionTTL, err = time.ParseDuration(env("SESSION_TTL", "12h"))
	if err != nil || c.SessionTTL < time.Second || c.SessionTTL > 30*24*time.Hour {
		return c, fmt.Errorf("SESSION_TTL must be between 1s and 720h")
	}
	c.CookieSecure, err = strconv.ParseBool(env("COOKIE_SECURE", "false"))
	if err != nil {
		return c, fmt.Errorf("COOKIE_SECURE: %w", err)
	}
	return c, nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
