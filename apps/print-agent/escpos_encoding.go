package main

import (
	"strings"
	"unicode"

	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
)

func hasHan(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func payloadNeedsGBK(p jobPayload) bool {
	if p.Locale == "zh" {
		return true
	}
	if hasHan(p.RestaurantName) || hasHan(p.stationName()) {
		return true
	}
	for _, ln := range p.Lines {
		if hasHan(ln.DisplayName) || hasHan(ln.Note) {
			return true
		}
	}
	return false
}

// labelsASCII strips accents for printers in GBK mode with pt/en locale.
func labelsASCII(lab ticketLabels) ticketLabels {
	return ticketLabels{
		connectionTest: "TESTE IMPRESSAO",
		guestOrder:     "Pedido",
		receipt:        "Recibo",
		tableNo:        "Mesa n.",
		guest:          "Conv.",
		items:          "Artigos",
		qty:            "Qtd",
		originalPrice:  "Preco",
		feeDetails:     "Detalhe taxas",
		originalTotal:  "Preco original",
		subtotal:       "Subtotal",
		amountDue:      "A pagar",
		orderTime:      "Hora pedido",
		printedBy:      "Impresso por",
		printTime:      "Hora impressao",
		printedByVal:   "Cliente/Estabelecimento",
		station:        "Estacao",
	}
}

func encodeWindows1252(s string) []byte {
	enc := charmap.Windows1252.NewEncoder()
	out, err := enc.Bytes([]byte(s))
	if err != nil {
		// Replace unmappable runes, then retry.
		var b strings.Builder
		for _, r := range s {
			if r < 128 {
				b.WriteRune(r)
				continue
			}
			t := string(r)
			if _, err2 := enc.Bytes([]byte(t)); err2 == nil {
				b.WriteRune(r)
			} else {
				b.WriteRune('?')
			}
		}
		out, _ = enc.Bytes([]byte(b.String()))
	}
	return out
}

func encodeGBK(s string) []byte {
	enc := simplifiedchinese.GBK.NewEncoder()
	out, err := enc.Bytes([]byte(s))
	if err != nil {
		var b strings.Builder
		for _, r := range s {
			t := string(r)
			if _, err2 := enc.Bytes([]byte(t)); err2 == nil {
				b.WriteRune(r)
			} else if r < 128 {
				b.WriteRune(r)
			} else {
				b.WriteRune('?')
			}
		}
		out, _ = enc.Bytes([]byte(b.String()))
	}
	return out
}
