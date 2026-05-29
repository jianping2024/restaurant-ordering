//go:build windows

package main

import (
	"fmt"
	"time"
	"unsafe"

	"github.com/alexbrainman/printer"
	"golang.org/x/sys/windows"
)

var (
	modWinspool          = windows.NewLazySystemDLL("winspool.drv")
	procOpenPrinterW     = modWinspool.NewProc("OpenPrinterW")
	procClosePrinter     = modWinspool.NewProc("ClosePrinter")
	procGetPrinterW      = modWinspool.NewProc("GetPrinterW")
	procGetJobW          = modWinspool.NewProc("GetJobW")
	procStartDocPrinterW = modWinspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = modWinspool.NewProc("EndDocPrinter")
	procStartPagePrinter = modWinspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = modWinspool.NewProc("EndPagePrinter")
	procWritePrinter     = modWinspool.NewProc("WritePrinter")
)

const (
	printerInfoLevel6 = 6
	printerInfoLevel8 = 8
)

type printerInfo6 struct {
	Status uint32
}

type printerInfo8 struct {
	cJobs    uint32
	dwStatus uint32
}

// jobInfo1 — 64-bit layout (JOB_INFO_1W).
type jobInfo1 struct {
	JobID        uint32
	_pad         uint32
	pPrinterName uintptr
	pMachineName uintptr
	pUserName    uintptr
	pDocument    uintptr
	pDataType    uintptr
	pStatus      uintptr
	Status       uint32
}

func winspoolPrinterStatusFlags(printerName string) (uint32, error) {
	namePtr, err := windows.UTF16PtrFromString(printerName)
	if err != nil {
		return 0, err
	}
	var h windows.Handle
	r0, _, e1 := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(namePtr)),
		uintptr(unsafe.Pointer(&h)),
		0,
	)
	if r0 == 0 {
		return 0, fmt.Errorf("open printer %q: %w", printerName, e1)
	}
	defer procClosePrinter.Call(uintptr(h))

	var needed uint32
	_, _, _ = procGetPrinterW.Call(
		uintptr(h),
		printerInfoLevel6,
		0,
		0,
		uintptr(unsafe.Pointer(&needed)),
	)
	if needed < uint32(unsafe.Sizeof(printerInfo6{})) {
		needed = uint32(unsafe.Sizeof(printerInfo6{}))
	}
	buf := make([]byte, needed)
	r0, _, e2 := procGetPrinterW.Call(
		uintptr(h),
		printerInfoLevel6,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
	)
	if r0 == 0 {
		return 0, fmt.Errorf("GetPrinter(%q): %w", printerName, e2)
	}
	return (*printerInfo6)(unsafe.Pointer(&buf[0])).Status, nil
}

func winspoolPrinterQueueStatus(printerName string) (uint32, error) {
	namePtr, err := windows.UTF16PtrFromString(printerName)
	if err != nil {
		return 0, err
	}
	var h windows.Handle
	r0, _, e1 := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(namePtr)),
		uintptr(unsafe.Pointer(&h)),
		0,
	)
	if r0 == 0 {
		return 0, fmt.Errorf("open printer %q: %w", printerName, e1)
	}
	defer procClosePrinter.Call(uintptr(h))

	var needed uint32
	_, _, _ = procGetPrinterW.Call(
		uintptr(h),
		printerInfoLevel8,
		0,
		0,
		uintptr(unsafe.Pointer(&needed)),
	)
	if needed < uint32(unsafe.Sizeof(printerInfo8{})) {
		needed = uint32(unsafe.Sizeof(printerInfo8{}))
	}
	buf := make([]byte, needed)
	r0, _, e2 := procGetPrinterW.Call(
		uintptr(h),
		printerInfoLevel8,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
	)
	if r0 == 0 {
		return 0, fmt.Errorf("GetPrinter level 8 (%q): %w", printerName, e2)
	}
	return (*printerInfo8)(unsafe.Pointer(&buf[0])).dwStatus, nil
}

func winspoolDiagnosticStatus(printerName string) (uint32, error) {
	flags6, err := winspoolPrinterStatusFlags(printerName)
	if err != nil {
		return 0, err
	}
	flags8, err8 := winspoolPrinterQueueStatus(printerName)
	if err8 != nil {
		flags8 = 0
	}
	return flags6 | flags8, nil
}

func winspoolJobStatus(h windows.Handle, jobID uint32) (uint32, error) {
	var needed uint32
	_, _, _ = procGetJobW.Call(
		uintptr(h),
		uintptr(jobID),
		1,
		0,
		0,
		uintptr(unsafe.Pointer(&needed)),
	)
	if needed < uint32(unsafe.Sizeof(jobInfo1{})) {
		needed = uint32(unsafe.Sizeof(jobInfo1{}))
	}
	buf := make([]byte, needed)
	r0, _, e1 := procGetJobW.Call(
		uintptr(h),
		uintptr(jobID),
		1,
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(needed),
		uintptr(unsafe.Pointer(&needed)),
	)
	if r0 == 0 {
		return 0, fmt.Errorf("GetJob(%d): %w", jobID, e1)
	}
	return (*jobInfo1)(unsafe.Pointer(&buf[0])).Status, nil
}

func winspoolVerifyJobOutcome(h windows.Handle, jobID uint32, printerName string) error {
	const (
		polls    = 8
		interval = 400 * time.Millisecond
	)
	var last uint32
	for i := 0; i < polls; i++ {
		time.Sleep(interval)
		st, err := winspoolJobStatus(h, jobID)
		if err != nil {
			break
		}
		last = st
		if winspoolJobStatusIsProblem(st) {
			return fmt.Errorf("print job on %q failed (job status 0x%X)", printerName, st)
		}
		if st&jobStatusComplete != 0 {
			break
		}
	}
	if winspoolJobStatusIsProblem(last) {
		return fmt.Errorf("print job on %q failed (job status 0x%X)", printerName, last)
	}
	return nil
}

type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

func winspoolCheckReady(printerName string) error {
	flags, err := winspoolDiagnosticStatus(printerName)
	if err != nil {
		return err
	}
	if winspoolStatusIsProblem(flags) {
		return fmt.Errorf("printer %q not ready (status 0x%X)", printerName, flags)
	}
	return nil
}

func winspoolPrint(printerName string, data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("empty print payload")
	}
	if err := winspoolCheckReady(printerName); err != nil {
		return fmt.Errorf("%w: %v", errPrinterNotReady, err)
	}
	namePtr, err := windows.UTF16PtrFromString(printerName)
	if err != nil {
		return err
	}
	var h windows.Handle
	r0, _, e1 := procOpenPrinterW.Call(
		uintptr(unsafe.Pointer(namePtr)),
		uintptr(unsafe.Pointer(&h)),
		0,
	)
	if r0 == 0 {
		return fmt.Errorf("open printer %q: %w", printerName, e1)
	}
	defer procClosePrinter.Call(uintptr(h))

	for _, dtype := range []string{"RAW", "XPS_PASS"} {
		if err := winspoolPrintRawDoc(h, printerName, dtype, data); err == nil {
			return nil
		} else if dtype == "XPS_PASS" {
			return err
		}
	}
	return fmt.Errorf("raw print to %q failed", printerName)
}

func winspoolPrintRawDoc(h windows.Handle, printerName, datatype string, data []byte) error {
	docName, _ := windows.UTF16PtrFromString("Mesa Print Agent")
	dtypePtr, err := windows.UTF16PtrFromString(datatype)
	if err != nil {
		return err
	}
	di := docInfo1{
		pDocName:    docName,
		pOutputFile: nil,
		pDatatype:   dtypePtr,
	}
	job, _, e1 := procStartDocPrinterW.Call(
		uintptr(h),
		1,
		uintptr(unsafe.Pointer(&di)),
	)
	if job == 0 {
		return fmt.Errorf("StartDocPrinter(%s): %w", datatype, e1)
	}
	jobID := uint32(job)

	r0, _, e2 := procStartPagePrinter.Call(uintptr(h))
	if r0 == 0 {
		procEndDocPrinter.Call(uintptr(h))
		return fmt.Errorf("StartPagePrinter: %w", e2)
	}

	var written uint32
	r0, _, e3 := procWritePrinter.Call(
		uintptr(h),
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	procEndPagePrinter.Call(uintptr(h))
	if r0 == 0 {
		procEndDocPrinter.Call(uintptr(h))
		return fmt.Errorf("WritePrinter to %q: %w", printerName, e3)
	}
	if int(written) != len(data) {
		procEndDocPrinter.Call(uintptr(h))
		return fmt.Errorf("short write to %q: %d/%d bytes", printerName, written, len(data))
	}
	procEndDocPrinter.Call(uintptr(h))
	return winspoolVerifyJobOutcome(h, jobID, printerName)
}

func listWinspoolPrinterNames() ([]string, error) {
	return printer.ReadNames()
}
