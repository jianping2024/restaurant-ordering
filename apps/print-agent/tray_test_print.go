package main

// runTrayTestPrint sends a connection-test slip to the first mapped station printer.
func runTrayTestPrint(cfg *config) error {
	return runTestPrintForStation(cfg, "", "")
}
