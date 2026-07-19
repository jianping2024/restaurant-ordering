package main

import (
	"testing"
	"time"
)

func TestJobQueueDedup(t *testing.T) {
	q := NewJobQueue()
	
	job := printJob{ID: "test-123", Type: "station_ticket", Status: "pending"}
	
	// First push should succeed
	if !q.Push(job) {
		t.Fatal("First push should succeed")
	}
	
	// Second push of same job should be deduplicated
	if q.Push(job) {
		t.Fatal("Second push should be deduplicated")
	}
	
	// Queue should have 1 item
	if q.Len() != 1 {
		t.Fatalf("Expected queue length 1, got %d", q.Len())
	}
	
	// Pop should return the job
	popped, ok := q.Pop()
	if !ok {
		t.Fatal("Pop should succeed")
	}
	if popped.ID != job.ID {
		t.Fatalf("Expected job ID %s, got %s", job.ID, popped.ID)
	}
	
	// Queue should be empty now
	if q.Len() != 0 {
		t.Fatalf("Expected queue length 0, got %d", q.Len())
	}
	
	// Pop from empty queue should fail
	_, ok = q.Pop()
	if ok {
		t.Fatal("Pop from empty queue should fail")
	}
}

func TestJobQueueFIFO(t *testing.T) {
	q := NewJobQueue()
	
	jobs := []printJob{
		{ID: "job-1", Type: "station_ticket", Status: "pending"},
		{ID: "job-2", Type: "order_receipt", Status: "pending"},
		{ID: "job-3", Type: "pre_bill", Status: "pending"},
	}
	
	// Push all jobs
	for _, job := range jobs {
		if !q.Push(job) {
			t.Fatalf("Failed to push job %s", job.ID)
		}
	}
	
	// Pop should return jobs in FIFO order
	for i, expectedJob := range jobs {
		popped, ok := q.Pop()
		if !ok {
			t.Fatalf("Pop %d should succeed", i)
		}
		if popped.ID != expectedJob.ID {
			t.Fatalf("Expected job ID %s, got %s", expectedJob.ID, popped.ID)
		}
	}
}

func TestJobQueueClearPendingAllowsReenqueue(t *testing.T) {
	q := NewJobQueue()
	job := printJob{ID: "closed-job", Type: "station_ticket", Status: "pending"}
	if !q.Push(job) {
		t.Fatal("push")
	}
	if q.ClearPending() != 1 {
		t.Fatal("expected 1 cleared")
	}
	if q.Len() != 0 {
		t.Fatal("queue should be empty")
	}
	if !q.Push(job) {
		t.Fatal("same job must enqueue again after ClearPending")
	}
}

func TestJobQueueForgetAllowsReenqueue(t *testing.T) {
	q := NewJobQueue()
	job := printJob{ID: "popped-job", Type: "order_receipt", Status: "pending"}
	if !q.Push(job) {
		t.Fatal("push")
	}
	got, ok := q.Pop()
	if !ok || got.ID != job.ID {
		t.Fatal("pop")
	}
	q.Forget(job.ID)
	if !q.Push(job) {
		t.Fatal("forgot id should allow re-push")
	}
}

func TestJobQueueCleanOld(t *testing.T) {
	q := NewJobQueue()
	
	// Add a job and manually mark it as old
	job := printJob{ID: "old-job", Type: "station_ticket", Status: "pending"}
	q.Push(job)
	
	// Manually mark as old (simulate time passing)
	q.mu.Lock()
	q.seen[job.ID] = time.Now().Add(-2 * time.Hour)
	q.mu.Unlock()
	
	// Add enough jobs to trigger cleanup (>1000)
	for i := 0; i < 1001; i++ {
		q.Push(printJob{ID: "job-" + time.Now().String() + string(rune(i)), Status: "pending"})
	}
	
	// Old entry should be cleaned
	q.mu.Lock()
	_, exists := q.seen[job.ID]
	q.mu.Unlock()
	
	if exists {
		t.Fatal("Old entry should have been cleaned")
	}
}
