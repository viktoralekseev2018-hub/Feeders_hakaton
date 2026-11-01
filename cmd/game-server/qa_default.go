//go:build !qatools

package main

import (
	"feeders/internal/auth"
	"net/http"
)

func qaHandler(h http.Handler, a *auth.Handler) http.Handler { return h }
