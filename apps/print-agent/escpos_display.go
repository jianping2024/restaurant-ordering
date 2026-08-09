package main

import (
	"strings"
	"unicode"
)

// Thermal layout width is measured in display columns (Font A cells), not raw runes.
// ASCII/Latin = 1 column; Han = 2. One model for truncate/wrap, station columns, and bitmap cells.

func displayCols(r rune) int {
	if unicode.Is(unicode.Han, r) {
		return 2
	}
	return 1
}

func displayWidth(s string) int {
	n := 0
	for _, r := range s {
		n += displayCols(r)
	}
	return n
}

// truncateDisplay caps s to maxCols display columns, appending "…" when trimmed.
func truncateDisplay(s string, maxCols int) string {
	if maxCols <= 0 {
		return ""
	}
	if displayWidth(s) <= maxCols {
		return s
	}
	if maxCols <= 1 {
		return "…"
	}
	limit := maxCols - 1 // room for ellipsis
	var b strings.Builder
	cols := 0
	for _, r := range s {
		w := displayCols(r)
		if cols+w > limit {
			break
		}
		b.WriteRune(r)
		cols += w
	}
	return b.String() + "…"
}

// wrapDisplay splits s into chunks of at most maxCols display columns (no ellipsis).
func wrapDisplay(s string, maxCols int) []string {
	if maxCols <= 0 || s == "" {
		return nil
	}
	var out []string
	var b strings.Builder
	cols := 0
	for _, r := range s {
		w := displayCols(r)
		if w > maxCols {
			if b.Len() > 0 {
				out = append(out, b.String())
				b.Reset()
				cols = 0
			}
			out = append(out, string(r))
			continue
		}
		if cols+w > maxCols {
			out = append(out, b.String())
			b.Reset()
			cols = 0
		}
		b.WriteRune(r)
		cols += w
	}
	if b.Len() > 0 {
		out = append(out, b.String())
	}
	return out
}

func padDisplayCols(b *strings.Builder, current, target int) int {
	for current < target {
		b.WriteByte(' ')
		current++
	}
	return current
}
