package main

// Win32 PRINTER_STATUS_* (subset) for USB/Windows queue health checks.
const (
	printerStatusError           = 0x00000002
	printerStatusPendingDeletion = 0x00000004
	printerStatusOffline         = 0x00000080
	printerStatusNotAvailable    = 0x00001000
)

func winspoolStatusIsProblem(flags uint32) bool {
	const bad = uint32(printerStatusError | printerStatusPendingDeletion | printerStatusOffline | printerStatusNotAvailable)
	return flags&bad != 0
}

// Win32 JOB_STATUS_* (subset).
const (
	jobStatusError     = 0x00000002
	jobStatusOffline   = 0x00000020
	jobStatusBlocked   = 0x00000200
	jobStatusComplete  = 0x00001000
	jobStatusSpooling  = 0x00000008
)

func winspoolJobStatusIsProblem(flags uint32) bool {
	const bad = uint32(jobStatusError | jobStatusOffline | jobStatusBlocked)
	return flags&bad != 0
}
