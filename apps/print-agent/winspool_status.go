package main

// Win32 PRINTER_STATUS_* (subset) for USB/Windows queue health checks.
const (
	printerStatusError           = 0x00000002
	printerStatusPendingDeletion = 0x00000004
	printerStatusOffline         = 0x00000080
	printerStatusNotAvailable    = 0x00001000
)

func winspoolStatusIsProblem(flags uint32) bool {
	bad := printerStatusError | printerStatusPendingDeletion | printerStatusOffline | printerStatusNotAvailable
	return flags&bad != 0
}
