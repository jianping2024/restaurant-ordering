package main

// reconcileSignal coalesces catch-up requests onto the Realtime compensation path
// (same GET pending-jobs as process restart). Buffer 1 drops duplicates.
type reconcileSignal struct {
	ch chan struct{}
}

func newReconcileSignal() *reconcileSignal {
	return &reconcileSignal{ch: make(chan struct{}, 1)}
}

func (s *reconcileSignal) request() {
	if s == nil {
		return
	}
	select {
	case s.ch <- struct{}{}:
	default:
	}
}

func (s *reconcileSignal) waitC() <-chan struct{} {
	if s == nil {
		return nil
	}
	return s.ch
}
