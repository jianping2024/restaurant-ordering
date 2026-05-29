//go:build !windows

package main

func winspoolProbeLog(printerName string) map[string]string {
	return map[string]string{"probe": "winspool", "open": "n/a_non_windows"}
}

func mergeProbeFields(dst map[string]string, probe map[string]string) {
	for k, v := range probe {
		dst[k] = v
	}
}
