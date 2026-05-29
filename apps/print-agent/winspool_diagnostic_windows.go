//go:build windows

package main

import (
	"fmt"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
)

// Win32 PRINTER_INFO_2 — fields used for offline diagnostics only (not for preparePrint gating).
const (
	printerAttributeWorkOffline = 0x00000400
	printerStatusOffline        = 0x00000080
	printerStatusPaperProblem   = 0x00000040
)

var procGetPrinterW = modWinspool.NewProc("GetPrinterW")

// winspoolProbeLog returns read-only signals for agent.log correlation (USB in vs out).
// Do not use these fields alone to block printing until validated on target hardware — see docs §1.2.
func winspoolProbeLog(printerName string) map[string]string {
	out := map[string]string{
		"probe": "winspool",
	}
	h, err := winspoolOpenPrinter(printerName)
	if err != nil {
		out["open"] = "fail"
		out["open_err"] = err.Error()
		return out
	}
	defer procClosePrinter.Call(uintptr(h))
	out["open"] = "ok"

	st, attrs, port, gerr := winspoolGetPrinterInfo2Fields(h)
	if gerr != nil {
		out["get_printer"] = "fail"
		out["get_printer_err"] = gerr.Error()
		return out
	}
	out["get_printer"] = "ok"
	out["printer_status"] = fmt.Sprintf("0x%X", st)
	out["printer_attributes"] = fmt.Sprintf("0x%X", attrs)
	out["flag_status_offline"] = fmt.Sprintf("%t", st&printerStatusOffline != 0)
	out["flag_status_paper_problem"] = fmt.Sprintf("%t", st&printerStatusPaperProblem != 0)
	out["flag_attr_work_offline"] = fmt.Sprintf("%t", attrs&printerAttributeWorkOffline != 0)
	if port != "" {
		out["port_name"] = port
	}
	return out
}

// winspoolGetPrinterInfo2Fields reads PRINTER_INFO_2 Status/Attributes and port name.
func winspoolGetPrinterInfo2Fields(h windows.Handle) (status, attributes uint32, portName string, err error) {
	var needed uint32
	_, _, _ = procGetPrinterW.Call(
		uintptr(h),
		2,
		0,
		0,
		uintptr(unsafe.Pointer(&needed)),
	)
	if needed == 0 {
		needed = 4096
	}
	buf := make([]byte, needed)
	r0, _, e1 := procGetPrinterW.Call(
		uintptr(h),
		2,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
	)
	if r0 == 0 {
		return 0, 0, "", fmt.Errorf("GetPrinter level 2: %w", e1)
	}
	if len(buf) < 128 {
		return 0, 0, "", fmt.Errorf("GetPrinter buffer too small (%d)", len(buf))
	}
	// amd64 PRINTER_INFO_2W: 13 pointer fields, then Attributes @104, Status @120.
	attributes = *(*uint32)(unsafe.Pointer(&buf[104]))
	status = *(*uint32)(unsafe.Pointer(&buf[120]))
	portName = utf16PtrAt(buf, 3) // pPortName
	return status, attributes, portName, nil
}

func utf16PtrAt(buf []byte, fieldIndex int) string {
	off := fieldIndex * int(unsafe.Sizeof(uintptr(0)))
	if off+int(unsafe.Sizeof(uintptr(0))) > len(buf) {
		return ""
	}
	ptr := *(*uintptr)(unsafe.Pointer(&buf[off]))
	if ptr == 0 {
		return ""
	}
	return windows.UTF16PtrToString((*uint16)(unsafe.Pointer(ptr)))
}

func mergeProbeFields(dst map[string]string, probe map[string]string) {
	for k, v := range probe {
		if strings.TrimSpace(v) == "" {
			continue
		}
		dst[k] = v
	}
}
