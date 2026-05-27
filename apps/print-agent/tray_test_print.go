package main

// runTrayTestPrint sends a connection-test slip to the first mapped station printer.
func runTrayTestPrint(cfg *config) error {
	_, err := runTrayTestPrintTarget(cfg)
	return err
}

// runTrayTestPrintTarget returns the printer display label used for the test slip.
func runTrayTestPrintTarget(cfg *config) (display string, err error) {
	if cfg == nil {
		return "", uiError("zh", "err_not_loaded")
	}
	sid, raw := firstMappedStationPrinter(cfg)
	if raw == "" {
		return "", uiError(cfg.uiLocale(), "err_save_mapping_first")
	}
	t, perr := parsePrinterTarget(raw)
	if perr != nil {
		return "", perr
	}
	return t.Display, runTestPrintForStation(cfg, sid, raw)
}
