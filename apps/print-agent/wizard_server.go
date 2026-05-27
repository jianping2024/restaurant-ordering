package main

import (
	"context"
	"net/http"
	"sync"
	"time"
)

var (
	wizardServersMu sync.Mutex
	wizardServers   []*http.Server
)

func trackWizardServer(srv *http.Server) {
	if srv == nil {
		return
	}
	wizardServersMu.Lock()
	wizardServers = append(wizardServers, srv)
	wizardServersMu.Unlock()
}

func untrackWizardServer(srv *http.Server) {
	if srv == nil {
		return
	}
	wizardServersMu.Lock()
	defer wizardServersMu.Unlock()
	for i, s := range wizardServers {
		if s == srv {
			wizardServers = append(wizardServers[:i], wizardServers[i+1:]...)
			return
		}
	}
}

// shutdownAllWizardServers stops local pair/configure/setup HTTP listeners (tray exit).
func shutdownAllWizardServers() {
	wizardServersMu.Lock()
	list := append([]*http.Server(nil), wizardServers...)
	wizardServersMu.Unlock()
	for _, srv := range list {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		_ = srv.Shutdown(ctx)
		cancel()
	}
}

func waitLocalWizard(ctx context.Context, srv *http.Server, done <-chan error) error {
	trackWizardServer(srv)
	defer untrackWizardServer(srv)
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return ctx.Err()
	case err := <-done:
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
		return err
	}
}
