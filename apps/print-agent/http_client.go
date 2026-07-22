package main

import (
	"net/http"
	"time"
)

// agentHTTPTimeout bounds all Mesa API calls (bootstrap, pending-jobs, claim, heartbeat).
// Matches auth_refresh; prevents silent multi-minute hangs on DefaultClient.
const agentHTTPTimeout = 15 * time.Second

var agentHTTPClient = &http.Client{Timeout: agentHTTPTimeout}
