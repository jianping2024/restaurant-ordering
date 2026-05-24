package main

import "testing"

func escDFeedsInRaw(raw []byte) []int {
	var feeds []int
	for i := 0; i+2 < len(raw); i++ {
		if raw[i] == 0x1B && raw[i+1] == 0x64 {
			feeds = append(feeds, int(raw[i+2]))
		}
	}
	return feeds
}

func cutDotsInRaw(raw []byte) byte {
	for i := 0; i+3 < len(raw); i++ {
		if raw[i] == 0x1D && raw[i+1] == 0x56 && raw[i+2] == 0x42 {
			return raw[i+3]
		}
	}
	return 0
}

func TestCutSequenceFeedsBeforeCut(t *testing.T) {
	w := newEscpos()
	w.text("footer")
	w.lf()
	raw := w.finish(true)
	feeds := escDFeedsInRaw(raw)
	if len(feeds) < 2 {
		t.Fatalf("expected leading and trailing ESC d feeds, got %v", feeds)
	}
	escD := feeds[len(feeds)-1]
	if escD < escposFeedLinesBeforeCutMin || escD > escposFeedLinesBeforeCutMax {
		t.Fatalf("ESC d feed out of range: %d", escD)
	}
	if !containsSubslice(raw, []byte{0x1D, 0x56, 0x42}) {
		t.Fatal("expected GS V 66 feed-then-cut")
	}
	dots := cutDotsInRaw(raw)
	if dots < escposFeedDotsBeforeCutMin || dots > escposFeedDotsBeforeCutMax {
		t.Fatalf("cut dots out of range: 0x%x", dots)
	}
	if containsSubslice(raw, []byte{0x1D, 0x56, 0x00}) {
		t.Fatal("immediate GS V 0 cut should not be used")
	}
}

func TestSymmetricTicketMargins(t *testing.T) {
	w := newEscpos()
	w.text("body")
	w.lf()
	raw := w.finish(true)
	feeds := escDFeedsInRaw(raw)
	if len(feeds) < 2 {
		t.Fatalf("expected leading+trailing ESC d, got %v", feeds)
	}
	if feeds[0] != feeds[len(feeds)-1] {
		t.Fatalf("leading/trailing feed mismatch: %v", feeds)
	}
}

func TestCutFeedShorterOnSmallTicket(t *testing.T) {
	short := newEscpos()
	short.text("footer")
	short.lf()
	shortRaw := short.finish(true)
	shortFeed := escDFeedsInRaw(shortRaw)[0]
	shortDots := cutDotsInRaw(shortRaw)

	long := newEscpos()
	long.size(true, true)
	for i := 0; i < 28; i++ {
		long.text("line")
		long.lf()
	}
	longRaw := long.finish(true)
	longFeeds := escDFeedsInRaw(longRaw)
	longFeed := longFeeds[0]
	longDots := cutDotsInRaw(longRaw)

	if shortFeed >= longFeed {
		t.Fatalf("short ESC d=%d should be less than long=%d", shortFeed, longFeed)
	}
	if shortDots >= longDots {
		t.Fatalf("short dots=0x%x should be less than long=0x%x", shortDots, longDots)
	}
	if shortFeed != escposFeedLinesBeforeCutMin || shortDots != escposFeedDotsBeforeCutMin {
		t.Fatalf("minimal ticket expected min feed, got ESC d=%d dots=0x%x", shortFeed, shortDots)
	}
	if longFeeds[0] != longFeeds[len(longFeeds)-1] {
		t.Fatalf("long ticket margins should stay symmetric: %v", longFeeds)
	}
}

func containsSubslice(b, sub []byte) bool {
	if len(sub) == 0 {
		return true
	}
	for i := 0; i+len(sub) <= len(b); i++ {
		ok := true
		for j := range sub {
			if b[i+j] != sub[j] {
				ok = false
				break
			}
		}
		if ok {
			return true
		}
	}
	return false
}
