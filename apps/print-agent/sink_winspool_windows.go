//go:build windows

package main

import (
	"fmt"
	"unsafe"

	"github.com/alexbrainman/printer"
	"golang.org/x/sys/windows"
)

var (
	modWinspool          = windows.NewLazySystemDLL("winspool.drv")
	procOpenPrinterW     = modWinspool.NewProc("OpenPrinterW")
	procClosePrinter     = modWinspool.NewProc("ClosePrinter")
	procGetPrinterW      = modWinspool.NewProc("GetPrinterW")
	procStartDocPrinterW = modWinspool.NewProc("StartDocPrinterW")
	procEndDocPrinter    = modWinspool.NewProc("EndDocPrinter")
	procStartPagePrinter = modWinspool.NewProc("StartPagePrinter")
	procEndPagePrinter   = modWinspool.NewProc("EndPagePrinter")
	procWritePrinter     = modWinspool.NewProc("WritePrinter")
)

const printerInfoLevel6 = 6

type printerInfo6 struct {
	Status uint32
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

func winspoolCheckReady(printerName string) error {
	flags, err := winspoolPrinterStatusFlags(printerName)
	if err != nil {
		return err
	}
	if winspoolStatusIsProblem(flags) {
		return fmt.Errorf("printer %q offline or unavailable (Windows status 0x%X)", printerName, flags)
	}
	return nil
}

type docInfo1 struct {
	pDocName    *uint16
	pOutputFile *uint16
	pDatatype   *uint16
}

func winspoolPrint(printerName string, data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("empty print payload")
	}
	if err := winspoolCheckReady(printerName); err != nil {
		return err
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
			if err := winspoolCheckReady(printerName); err != nil {
				return err
			}
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
	defer procEndDocPrinter.Call(uintptr(h))

	r0, _, e2 := procStartPagePrinter.Call(uintptr(h))
	if r0 == 0 {
		return fmt.Errorf("StartPagePrinter: %w", e2)
	}
	defer procEndPagePrinter.Call(uintptr(h))

	var written uint32
	r0, _, e3 := procWritePrinter.Call(
		uintptr(h),
		uintptr(unsafe.Pointer(&data[0])),
		uintptr(len(data)),
		uintptr(unsafe.Pointer(&written)),
	)
	if r0 == 0 {
		return fmt.Errorf("WritePrinter to %q: %w", printerName, e3)
	}
	if int(written) != len(data) {
		return fmt.Errorf("short write to %q: %d/%d bytes", printerName, written, len(data))
	}
	return nil
}

func listWinspoolPrinterNames() ([]string, error) {
	return printer.ReadNames()
}
