package main

import (
	"regexp"
	"strings"
	"unicode"

	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/encoding/simplifiedchinese"
)

var defaultGuestPayerRe = regexp.MustCompile(`(?i)^(客人|Guest|Pessoa)\s*(\d+)$`)

// formatSplitPayerForReceipt strips UI placeholder names (e.g. "客人 2") so Latin mode shows "Guest:2".
func formatSplitPayerForReceipt(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	if m := defaultGuestPayerRe.FindStringSubmatch(name); len(m) == 3 {
		return m[2]
	}
	return name
}

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

// stationTicketNeedsGBK — internal station slips use a fixed English header ("restaurant").
func stationTicketNeedsGBK(p jobPayload) bool {
	for _, ln := range p.Lines {
		if hasHan(ln.CategoryGroupHeader) || hasHan(ln.DisplayName) || hasHan(ln.Note) {
			return true
		}
	}
	return false
}

// stationTicketLabels — fixed English layout per docs/print-samples guest-order reference.
func stationTicketLabels() ticketLabels {
	return labelsFor("en")
}

// receiptTicketLabels — fixed English checkout receipt per reference sample.
func receiptTicketLabels() ticketLabels {
	return labelsFor("en")
}

// receiptTicketNeedsGBK — receipt/pre-bill paper uses English headers and does not print
// restaurant_name; do not switch the whole ticket to GBK because of a Chinese venue name in payload.
func receiptTicketNeedsGBK(p jobPayload) bool {
	if hasHan(formatSplitPayerForReceipt(p.PayerName)) {
		return true
	}
	for _, ln := range p.Lines {
		if hasHan(ln.DisplayName) || hasHan(ln.Note) {
			return true
		}
	}
	return false
}

// connectionTestNeedsGBK — test slip prints venue name only (plus ASCII labels).
func connectionTestNeedsGBK(p jobPayload) bool {
	return hasHan(p.venueName())
}

// labelsASCII strips accents for printers in GBK mode with pt/en locale.
func labelsASCII(lab ticketLabels) ticketLabels {
	return ticketLabels{
		connectionTest: "TESTE IMPRESSAO",
		guestOrder:     "Pedido",
		receipt:        "Recibo",
		preBill:        "Pre-Conta",
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
		orderedBy:      "Pedido por",
		amountPaid:     "Valor pago",
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
			}
			// Skip unmappable runes (never print "?" placeholders on receipts).
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
			}
			// Skip unmappable runes.
		}
		out, _ = enc.Bytes([]byte(b.String()))
	}
	return out
}
