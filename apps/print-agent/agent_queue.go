package main

// deferBlockedHead rotates the head job to the end when other jobs remain.
// If every job in the batch was blocked once (spins >= len), returns allBlocked so the caller can sleep and refetch.
func deferBlockedHead(queue []printJob, spins *int) (out []printJob, allBlocked bool) {
	if len(queue) <= 1 {
		if spins != nil {
			*spins = 0
		}
		return nil, true
	}
	if spins != nil {
		*spins++
		if *spins >= len(queue) {
			*spins = 0
			return nil, true
		}
	}
	return append(queue[1:], queue[0]), false
}
