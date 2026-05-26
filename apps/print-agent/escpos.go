package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// 80mm paper ≈ 48 chars (Font A). Layout follows reference thermal receipts.
const escposWidth = 48
const escposTabWidth = 4 // one tab stop for category group headers on station slips

// Top: no extra LF — most printers already feed after ESC @ init.
// Bottom: 2× single-height "restaurant" row before cut (visible pad only).
const (
	escposTopMarginLines    = 0
	escposBottomMarginLines = 2
)

// Minimal feed before blade after bottom pad (not part of visible margin).
const (
	escposCutFeedDotsDefault = 0x18
	escposCutFeedDotsTall    = 0x38 // tickets with double-height blocks
)

type ticketLabels struct {
	connectionTest string
	guestOrder     string
	receipt        string
	preBill        string
	tableNo        string
	guest          string
	items          string
	qty            string
	originalPrice  string
	feeDetails     string
	originalTotal  string
	subtotal       string
	amountDue      string
	orderTime      string
	printedBy      string
	printTime      string
	printedByVal   string
	orderedBy      string
	amountPaid     string
	station        string
}

func labelsFor(locale string) ticketLabels {
	switch locale {
	case "zh":
		return ticketLabels{
			connectionTest: "打印测试",
			guestOrder:     "出菜单",
			receipt:        "收据",
			preBill:        "预结单",
			tableNo:        "桌号",
			guest:          "人数",
			items:          "菜品",
			qty:            "数量",
			originalPrice:  "原价",
			feeDetails:     "费用明细",
			originalTotal:  "原价合计",
			subtotal:       "小计",
			amountDue:      "应付",
			orderTime:      "下单时间",
			printedBy:      "打印",
			printTime:      "打印时间",
			printedByVal:   "系统",
			orderedBy:      "下单方",
			amountPaid:     "实付",
			station:        "档口",
		}
	case "en":
		return ticketLabels{
			connectionTest: "PRINT TEST",
			guestOrder:     "Guest Order",
			receipt:        "Receipt",
			preBill:        "Pre-Bill",
			tableNo:        "Table No.",
			guest:          "Guest",
			items:          "Items",
			qty:            "Qty",
			originalPrice:  "Original Price",
			feeDetails:     "Fee Details",
			originalTotal:  "Original price",
			subtotal:       "Subtotal",
			amountDue:      "Amount Due",
			orderTime:      "Order Time",
			printedBy:      "Printed By",
			printTime:      "Print Time",
			printedByVal:   "Customer/Merchant",
			orderedBy:      "Ordered By",
			amountPaid:     "Amount Paid",
			station:        "Station",
		}
	default: // pt (pt-PT semantics)
		return ticketLabels{
			connectionTest: "TESTE IMPRESSÃO",
			guestOrder:     "Pedido",
			receipt:        "Recibo",
			preBill:        "Pré-conta",
			tableNo:        "Mesa n.º",
			guest:          "Conv.",
			items:          "Artigos",
			qty:            "Qtd",
			originalPrice:  "Preço",
			feeDetails:     "Detalhe taxas",
			originalTotal:  "Preço original",
			subtotal:       "Subtotal",
			amountDue:      "A pagar",
			orderTime:      "Hora pedido",
			printedBy:      "Impresso por",
			printTime:      "Hora impressão",
			printedByVal:   "Cliente/Estabelecimento",
			orderedBy:      "Pedido por",
			amountPaid:     "Valor pago",
			station:        "Estação",
		}
	}
}

type jobLine struct {
	ItemIndex           int     `json:"item_index"`
	DisplayName         string  `json:"display_name"`
	Qty                 int     `json:"qty"`
	Note                string  `json:"note"`
	UnitPrice           float64 `json:"unit_price"`
	CategoryGroupSort   int     `json:"category_group_sort"`
	CategoryGroupHeader string  `json:"category_group_header"`
}

type jobPayload struct {
	Locale               string    `json:"locale"`
	ConnectionTest       bool      `json:"connection_test"`
	RestaurantName       string    `json:"restaurant_name"`
	TableDisplayName     string    `json:"display_name"`
	TableID              string    `json:"table_id"`
	GuestCount           int       `json:"guest_count"`
	StationDisplayNamePt string    `json:"station_display_name_pt"`
	StationDisplayNameEn string    `json:"station_display_name_en"`
	StationDisplayNameZh string    `json:"station_display_name_zh"`
	Lines                []jobLine `json:"lines"`
	Subtotal             float64   `json:"subtotal"`
	AmountDue            float64   `json:"amount_due"`
	AmountPaid           float64   `json:"amount_paid"`
	PaymentMethod        string    `json:"payment_method"`
	OrderedBy            string    `json:"ordered_by"`
	OrderTime            string    `json:"order_time"`
	PrintTime            string    `json:"print_time"`
	// pre_bill | split_payment | final (empty → final on order_receipt)
	ReceiptVariant string `json:"receipt_variant"`
	PayerName      string `json:"payer_name"`
}

func parseJobPayload(job printJob) jobPayload {
	var p jobPayload
	_ = json.Unmarshal(job.Payload, &p)
	if p.Locale == "" {
		p.Locale = "pt"
	}
	return p
}

// formatTableNoLabel prints table labels from JSON (string or legacy numeric).
func formatTableNoLabel(lab ticketLabels, tableNo string) string {
	t := strings.TrimSpace(tableNo)
	if t == "" {
		return ""
	}
	if len(t) <= 2 {
		if n, err := strconv.Atoi(t); err == nil && strconv.Itoa(n) == t {
			return fmt.Sprintf("%s:%02d", lab.tableNo, n)
		}
	}
	return fmt.Sprintf("%s:%s", lab.tableNo, t)
}

func (p jobPayload) tableNoLabel(lab ticketLabels) string {
	return formatTableNoLabel(lab, p.TableDisplayName)
}

// receiptHeaderTitle — receipts use English labels (lab); dish lines keep menu display names.
func receiptHeaderTitle(variant string, lab ticketLabels) string {
	if variant == "pre_bill" {
		if t := strings.TrimSpace(lab.preBill); t != "" {
			return t
		}
	}
	return lab.receipt
}

func (p jobPayload) stationName() string {
	switch p.Locale {
	case "zh":
		if s := strings.TrimSpace(p.StationDisplayNameZh); s != "" {
			return s
		}
	case "en":
		if s := strings.TrimSpace(p.StationDisplayNameEn); s != "" {
			return s
		}
	}
	if s := strings.TrimSpace(p.StationDisplayNamePt); s != "" {
		return s
	}
	return strings.TrimSpace(p.StationDisplayNameEn)
}

func (p jobPayload) venueName() string {
	if s := strings.TrimSpace(p.RestaurantName); s != "" {
		return s
	}
	return "restaurant"
}

type escposWriter struct {
	prefix          []byte
	content         bytes.Buffer
	gbk             bool
	hadDoubleHeight bool
}

func writeMarginLines(b *bytes.Buffer, lines int) {
	for i := 0; i < lines; i++ {
		b.WriteByte('\n')
	}
}

func cutFeedDots(hadDoubleHeight bool) byte {
	if hadDoubleHeight {
		return escposCutFeedDotsTall
	}
	return escposCutFeedDotsDefault
}

func newEscpos() *escposWriter {
	w := &escposWriter{}
	w.init()
	return w
}

func newEscposForStationTicket(p jobPayload) *escposWriter {
	w := newEscpos()
	if stationTicketNeedsGBK(p) {
		w.enableGBK()
	} else {
		w.enableLatin()
	}
	return w
}

func newEscposForReceiptTicket(p jobPayload) *escposWriter {
	w := newEscpos()
	if receiptTicketNeedsGBK(p) {
		w.enableGBK()
	} else {
		w.enableLatin()
	}
	return w
}

func newEscposForPayload(p jobPayload) *escposWriter {
	w := newEscpos()
	if payloadNeedsGBK(p) {
		w.enableGBK()
	} else {
		w.enableLatin()
	}
	return w
}

func newEscposForConnectionTest(p jobPayload) *escposWriter {
	w := newEscpos()
	if connectionTestNeedsGBK(p) {
		w.enableGBK()
	} else {
		w.enableLatin()
	}
	return w
}

func (w *escposWriter) init() { w.prefix = append(w.prefix, 0x1B, 0x40) }

// enableLatin selects WPC1252 (covers Portuguese accents on most 80mm printers).
func (w *escposWriter) enableLatin() {
	w.gbk = false
	w.prefix = append(w.prefix, 0x1B, 0x74, 16)
}

// enableGBK selects simplified Chinese mode (common on POS-80 USB printers).
func (w *escposWriter) enableGBK() {
	w.gbk = true
	w.prefix = append(w.prefix, 0x1C, 0x26) // FS &
}

func (w *escposWriter) align(mode byte) {
	w.content.Write([]byte{0x1B, 0x61, mode})
}

func (w *escposWriter) bold(on bool) {
	n := byte(0)
	if on {
		n = 1
	}
	w.content.Write([]byte{0x1B, 0x45, n})
}

func (w *escposWriter) size(doubleW, doubleH bool) {
	if doubleH {
		w.hadDoubleHeight = true
	}
	n := byte(0)
	if doubleH {
		n |= 0x01
	}
	if doubleW {
		n |= 0x10
	}
	w.content.Write([]byte{0x1D, 0x21, n})
}

func (w *escposWriter) text(s string) {
	if w.gbk {
		w.content.Write(encodeGBK(s))
	} else {
		w.content.Write(encodeWindows1252(s))
	}
}

func (w *escposWriter) lf() {
	w.content.WriteByte('\n')
}

func (w *escposWriter) writeResetPrintMode(out *bytes.Buffer) {
	out.Write([]byte{0x1B, 0x61, 0})
	out.Write([]byte{0x1D, 0x21, 0})
	out.Write([]byte{0x1B, 0x45, 0})
	out.Write([]byte{0x1B, 0x32}) // ESC 2 — default line spacing after enlarged text
}

// finish assembles init + top pad + body + bottom pad (+ cut feed when cut is true).
func (w *escposWriter) finish(cut bool) []byte {
	var out bytes.Buffer
	out.Write(w.prefix)
	writeMarginLines(&out, escposTopMarginLines)
	out.Write(w.content.Bytes())
	if cut {
		w.writeResetPrintMode(&out)
		if w.gbk {
			out.Write([]byte{0x1C, 0x2E}) // FS . — exit Chinese mode before feed/cut
		}
		writeMarginLines(&out, escposBottomMarginLines)
		out.Write([]byte{0x1D, 0x56, 0x42, cutFeedDots(w.hadDoubleHeight)})
	}
	return out.Bytes()
}
func (w *escposWriter) separator(ch rune) {
	w.align(0)
	w.size(false, false)
	w.bold(false)
	line := strings.Repeat(string(ch), escposWidth)
	w.text(line)
	w.lf()
}

const (
	escposColItems = 28
	escposColQty   = 4
	escposColPrice = escposWidth - escposColItems - escposColQty
)

func padField(s string, width int, alignRight bool) string {
	r := []rune(truncateRunes(s, width))
	gap := width - len(r)
	if gap < 0 {
		gap = 0
	}
	if alignRight {
		return strings.Repeat(" ", gap) + string(r)
	}
	return string(r) + strings.Repeat(" ", gap)
}

func escposThreeColLine(left, mid, right string) string {
	return padField(left, escposColItems, false) +
		padField(mid, escposColQty, true) +
		padField(right, escposColPrice, true)
}

func (w *escposWriter) rightLine(s string, bold bool) {
	w.align(2)
	w.size(false, false)
	w.bold(bold)
	w.text(s)
	w.lf()
	w.bold(false)
	w.align(0)
}

func escposPadLine(left, right string, width int) string {
	left = truncateRunes(left, width-2)
	right = truncateRunes(right, width-2)
	gap := width - runeLen(left) - runeLen(right)
	if gap < 1 {
		gap = 1
	}
	return left + strings.Repeat(" ", gap) + right
}

func runeLen(s string) int {
	return len([]rune(s))
}

func truncateRunes(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	if max <= 1 {
		return "…"
	}
	return string(r[:max-1]) + "…"
}

func formatItemLabel(idx int, name string) string {
	name = strings.TrimSpace(name)
	if idx > 0 {
		return fmt.Sprintf("%03d-%s", idx, name)
	}
	return name
}

func formatMoney(v float64) string {
	return fmt.Sprintf("%.2f", v)
}

func nowLocal() string {
	return time.Now().Format("2006-01-02 15:04")
}

func escposFromJob(job printJob) []byte {
	p := parseJobPayload(job)
	lab := labelsFor(p.Locale)
	if payloadNeedsGBK(p) && p.Locale == "pt" {
		lab = labelsASCII(lab)
	}

	switch job.Type {
	case "station_ticket":
		return buildStationTicket(p)
	case "order_receipt":
		if p.ConnectionTest {
			return buildConnectionTest(p, lab)
		}
		variant := strings.TrimSpace(p.ReceiptVariant)
		if variant == "" {
			variant = "final"
		}
		withPayment := variant == "final" || variant == "split_payment"
		return buildOrderReceipt(p, receiptTicketLabels(), withPayment, variant)
	case "pre_bill":
		p.ReceiptVariant = "pre_bill"
		return buildOrderReceipt(p, receiptTicketLabels(), false, "pre_bill")
	default:
		return buildStationTicket(p)
	}
}

// buildStationTicket — internal station slip; English Guest Order layout (reference sample).
func buildStationTicket(p jobPayload) []byte {
	lab := stationTicketLabels()
	w := newEscposForStationTicket(p)

	w.align(0)
	w.size(false, false)
	w.bold(false)
	w.text("restaurant")
	w.lf()

	w.align(1)
	w.size(true, true)
	w.bold(true)
	w.text(lab.guestOrder)
	w.lf()

	w.separator('-')

	w.align(0)
	w.size(true, true)
	w.bold(true)
	if line := p.tableNoLabel(lab); line != "" {
		w.text(line)
	}
	w.lf()

	w.size(false, false)
	w.bold(false)
	if p.GuestCount > 0 {
		w.text(fmt.Sprintf("%s:%d", lab.guest, p.GuestCount))
		w.lf()
	}

	w.separator('-')

	w.text(escposPadLine(lab.items, lab.qty, escposWidth))
	w.lf()

	lines := append([]jobLine(nil), p.Lines...)
	sort.SliceStable(lines, func(i, j int) bool {
		a, b := lines[i], lines[j]
		if a.CategoryGroupSort != b.CategoryGroupSort {
			return a.CategoryGroupSort < b.CategoryGroupSort
		}
		return a.ItemIndex < b.ItemIndex
	})

	lastGroupHeader := ""
	for _, ln := range lines {
		groupHeader := strings.TrimSpace(ln.CategoryGroupHeader)
		if groupHeader != "" && groupHeader != lastGroupHeader {
			indent := strings.Repeat(" ", escposTabWidth)
			w.text(indent + truncateRunes(groupHeader, escposWidth-escposTabWidth))
			w.lf()
			lastGroupHeader = groupHeader
		}

		qty := ln.Qty
		if qty <= 0 {
			qty = 1
		}
		label := strings.TrimSpace(ln.DisplayName)
		if label == "" {
			label = formatItemLabel(ln.ItemIndex, "")
		}
		w.text(escposPadLine(label, fmt.Sprintf("%d", qty), escposWidth))
		w.lf()
		if note := strings.TrimSpace(ln.Note); note != "" {
			w.text("  " + truncateRunes(note, escposWidth-2))
			w.lf()
		}
	}

	w.separator('-')

	orderAt := strings.TrimSpace(p.OrderTime)
	if orderAt == "" {
		orderAt = nowLocal()
	}
	w.text(fmt.Sprintf("%s:%s", lab.orderTime, orderAt))
	w.lf()
	w.text(fmt.Sprintf("%s:%s", lab.printedBy, lab.printedByVal))
	w.lf()

	return w.finish(true)
}

// buildOrderReceipt — checkout / pre-bill / split-payment / final (English layout per sample).
func buildOrderReceipt(p jobPayload, lab ticketLabels, withPayment bool, variant string) []byte {
	w := newEscposForReceiptTicket(p)
	isSplit := variant == "split_payment"
	payer := formatSplitPayerForReceipt(p.PayerName)

	w.align(0)
	w.size(false, false)
	w.bold(false)
	w.text("restaurant")
	w.lf()

	w.align(1)
	w.size(true, true)
	w.bold(true)
	w.text(receiptHeaderTitle(variant, lab))
	w.lf()

	w.separator('-')

	w.align(1)
	w.size(true, true)
	w.bold(true)
	if line := p.tableNoLabel(lab); line != "" {
		w.text(line)
		w.lf()
	}
	w.size(false, false)
	w.bold(false)
	w.align(0)
	if isSplit && payer != "" {
		w.text(fmt.Sprintf("%s:%s", lab.guest, payer))
		w.lf()
	} else if p.GuestCount > 0 {
		w.text(fmt.Sprintf("%s:%d", lab.guest, p.GuestCount))
		w.lf()
	}

	w.separator('-')

	var sum float64
	hasPrice := false
	if len(p.Lines) > 0 {
		w.text(escposThreeColLine(lab.items, lab.qty, lab.originalPrice))
		w.lf()
		for _, ln := range p.Lines {
			qty := ln.Qty
			if qty <= 0 {
				qty = 1
			}
			label := strings.TrimSpace(ln.DisplayName)
			lineTotal := ln.UnitPrice * float64(qty)
			if ln.UnitPrice > 0 {
				hasPrice = true
				sum += lineTotal
			}
			priceCol := ""
			if ln.UnitPrice > 0 {
				priceCol = formatMoney(lineTotal)
			}
			w.text(escposThreeColLine(label, fmt.Sprintf("%d", qty), priceCol))
			w.lf()
		}
		w.separator('-')
	}

	if p.Subtotal > 0 {
		sum = p.Subtotal
		hasPrice = true
	}
	if p.AmountDue > 0 {
		sum = p.AmountDue
		hasPrice = true
	}
	if hasPrice && len(p.Lines) == 0 {
		w.separator('-')
	}
	if hasPrice {
		if !isSplit {
			w.text(lab.feeDetails)
			w.lf()
			w.text(escposPadLine(lab.originalTotal, formatMoney(sum), escposWidth))
			w.lf()
			w.text(escposPadLine(lab.subtotal, formatMoney(sum), escposWidth))
			w.lf()
		}
		due := sum
		if p.AmountDue > 0 {
			due = p.AmountDue
		}
		w.rightLine(lab.amountDue+":"+formatMoney(due), true)
		if withPayment {
			paid := due
			if p.AmountPaid > 0 {
				paid = p.AmountPaid
			}
			w.rightLine(lab.amountPaid+":"+formatMoney(paid), true)
			method := strings.TrimSpace(p.PaymentMethod)
			if method == "" {
				method = "Cash"
			}
			w.rightLine("-"+method+" Payment:"+formatMoney(paid), false)
		}
		if isSplit {
			w.separator('-')
		}
	}

	w.separator('-')

	orderedByVal := strings.TrimSpace(p.OrderedBy)
	if orderedByVal == "" {
		orderedByVal = lab.printedByVal
	}
	orderAt := strings.TrimSpace(p.OrderTime)
	if orderAt == "" {
		orderAt = nowLocal()
	}
	printAt := strings.TrimSpace(p.PrintTime)
	if printAt == "" {
		printAt = nowLocal()
	}
	w.text(fmt.Sprintf("%s:%s", lab.orderedBy, orderedByVal))
	w.lf()
	w.text(fmt.Sprintf("%s:%s", lab.orderTime, orderAt))
	w.lf()
	w.text(fmt.Sprintf("%s:%s", lab.printedBy, "restaurant"))
	w.lf()
	w.text(fmt.Sprintf("%s:%s", lab.printTime, printAt))
	w.lf()

	return w.finish(true)
}

func buildConnectionTest(p jobPayload, lab ticketLabels) []byte {
	w := newEscposForConnectionTest(p)
	w.align(1)
	w.size(true, true)
	w.bold(true)
	w.text(lab.connectionTest)
	w.lf()
	w.size(false, false)
	w.bold(false)
	w.separator('-')
	w.align(0)
	w.text(p.venueName())
	w.lf()
	w.text(nowLocal())
	w.lf()
	return w.finish(true)
}
