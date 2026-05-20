//go:build windows

package main

import (
	"fmt"

	"github.com/alexbrainman/printer"
)

func winspoolPrint(printerName string, data []byte) error {
	p, err := printer.Open(printerName)
	if err != nil {
		return fmt.Errorf("open printer %q: %w", printerName, err)
	}
	defer p.Close()
	n, err := p.Write(data)
	if err != nil {
		return fmt.Errorf("write to %q: %w", printerName, err)
	}
	if n != len(data) {
		return fmt.Errorf("short write to %q: %d/%d bytes", printerName, n, len(data))
	}
	return nil
}

func listWinspoolPrinterNames() ([]string, error) {
	return printer.ReadNames()
}
