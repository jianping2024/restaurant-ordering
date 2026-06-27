package main

import "testing"

func TestBrandConstants(t *testing.T) {
	if productName != "MesaGo" {
		t.Fatalf("productName = %q", productName)
	}
	if printAgentName != "MesaGo Print Agent" {
		t.Fatalf("printAgentName = %q", printAgentName)
	}
	if printTrayTitleEN != "MesaGo Print" {
		t.Fatalf("printTrayTitleEN = %q", printTrayTitleEN)
	}
}
