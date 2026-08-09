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

// wrapDisplayFirstRest wraps s so the first chunk uses firstMax columns and the
// remainder uses restMax (e.g. note body after a same-line Latin prefix).
func wrapDisplayFirstRest(s string, firstMax, restMax int) []string {
	if restMax <= 0 || s == "" {
		return nil
	}
	if firstMax <= 0 {
		return wrapDisplay(s, restMax)
	}
	var first strings.Builder
	cols := 0
	runes := []rune(s)
	i := 0
	for i < len(runes) {
		w := displayCols(runes[i])
		if cols+w > firstMax {
			break
		}
		first.WriteRune(runes[i])
		cols += w
		i++
	}
	var out []string
	if first.Len() > 0 {
		out = append(out, first.String())
	}
	rest := string(runes[i:])
	if rest == "" {
		return out
	}
	if first.Len() == 0 {
		// first rune wider than firstMax — fall back to restMax wrapping
		return wrapDisplay(s, restMax)
	}
	return append(out, wrapDisplay(rest, restMax)...)
}

func padDisplayCols(b *strings.Builder, current, target int) int {
	for current < target {
		b.WriteByte(' ')
		current++
	}
	return current
}
