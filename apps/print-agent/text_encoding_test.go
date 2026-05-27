package main

import "testing"

func TestResolvePaperEncodingAutoGBK(t *testing.T) {
	cfg := &config{TextEncoding: "auto"}
	if cfg.resolvePaperEncoding(true) != paperEncGBK {
		t.Fatal("auto + chinese should default gbk for UNYKA-class printers")
	}
	if cfg.resolvePaperEncoding(false) != paperEncLatin {
		t.Fatal("latin when no chinese")
	}
}

func TestResolvePaperEncodingGBK(t *testing.T) {
	cfg := &config{TextEncoding: "gbk"}
	if cfg.resolvePaperEncoding(true) != paperEncGBK {
		t.Fatal("gbk")
	}
}
