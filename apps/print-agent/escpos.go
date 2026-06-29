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

// escposNoteIndentSpaces — sub-line indent before underlined item notes (station + receipt).
const escposNoteIndentSpaces = 1

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
	ShareQtyLabel       string  `json:"share_qty_label"`
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
	// pre_bill | checkout_bill | split_payment | final (empty → final on order_receipt)
	ReceiptVariant string `json:"receipt_variant"`
	PayerName      string `json:"payer_name"`
}

func parseJobPayload(job printJob) jobPayload {
	var p jobPayload
	_ = json.Unmarshal(job.Payload, &p)
	p.Locale = normalizePrintLocale(p.Locale)
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
	enc             paperEncoding
	gbkActive       bool // true while FS & Chinese mode is on (per-line enter/exit for ASCII)
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
	w.applyEncoding(loadPaperEncodingForPayload(stationTicketNeedsGBK(p)))
	return w
}

func newEscposForReceiptTicket(p jobPayload) *escposWriter {
	w := newEscpos()
	w.applyEncoding(loadPaperEncodingForPayload(receiptTicketNeedsGBK(p)))
	return w
}

func newEscposForConnectionTest(p jobPayload) *escposWriter {
	w := newEscpos()
	w.applyEncoding(loadPaperEncodingForPayload(connectionTestNeedsGBK(p)))
	return w
}

func (w *escposWriter) applyEncoding(enc paperEncoding) {
	switch enc {
	case paperEncGBK:
		w.enableGBK()
	case paperEncUTF8:
		w.enableUTF8()
	default:
		w.enableLatin()
	}
}

func (w *escposWriter) init() { w.prefix = append(w.prefix, 0x1B, 0x40) }

// enableLatin selects WPC1252 (covers Portuguese accents on most 80mm printers).
func (w *escposWriter) enableLatin() {
	w.enc = paperEncLatin
	w.prefix = append(w.prefix, 0x1B, 0x74, 16)
}

// enableGBK — per-line FS & / FS . in text(); do not leave FS & on for whole ticket (UNYKA ASCII needs FS .).
func (w *escposWriter) enableGBK() {
	w.enc = paperEncGBK
	w.gbkActive = false
}

func (w *escposWriter) gbkEnter() {
	if w.gbkActive {
		return
	}
	w.content.Write([]byte{0x1C, 0x26}) // FS &
	w.gbkActive = true
}

func (w *escposWriter) gbkExit() {
	if !w.gbkActive {
		return
	}
	w.content.Write([]byte{0x1C, 0x2E}) // FS .
	w.gbkActive = false
}

// enableUTF8 — ESC 9 (common on Xprinter / many 80mm; works when GBK mode is ignored).
func (w *escposWriter) enableUTF8() {
	w.enc = paperEncUTF8
	w.prefix = append(w.prefix, 0x1B, 0x39, 0x01)
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

func (w *escposWriter) underline(on bool) {
	n := byte(0)
	if on {
		n = 1
	}
	w.content.Write([]byte{0x1B, 0x2D, n})
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
	switch w.enc {
	case paperEncGBK:
		if hasHan(s) {
			w.gbkEnter()
			w.content.Write(encodeGBK(s))
		} else {
			w.gbkExit()
			w.content.Write([]byte(s))
		}
	case paperEncUTF8:
		w.content.Write([]byte(s))
	default:
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
	out.Write([]byte{0x1B, 0x2D, 0})
	out.Write([]byte{0x1C, 0x21, 0x00}) // FS ! — reset Chinese print modes (GS ! does not affect Han)
	out.Write([]byte{0x1B, 0x32})       // ESC 2 — default line spacing
	if w.enc == paperEncGBK && w.gbkActive {
		out.Write([]byte{0x1C, 0x2E})
		w.gbkActive = false
	}
}

// finish assembles init + top pad + body + bottom pad (+ cut feed when cut is true).
func (w *escposWriter) finish(cut bool) []byte {
	var out bytes.Buffer
	out.Write(w.prefix)
	writeMarginLines(&out, escposTopMarginLines)
	out.Write(w.content.Bytes())
	if cut {
		w.writeResetPrintMode(&out)
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
	escposColItems = 25 // leaves 9 for Qty (A999-C999) and 14 for "Original Price"
	escposColQty   = 9
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

func padFieldCenter(s string, width int) string {
	r := []rune(truncateRunes(s, width))
	gap := width - len(r)
	if gap <= 0 {
		return string(r)
	}
	left := gap / 2
	return strings.Repeat(" ", left) + string(r) + strings.Repeat(" ", gap-left)
}

func escposThreeColLine(left, mid, right string) string {
	return padField(left, escposColItems, false) +
		padFieldCenter(mid, escposColQty) +
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

// writeBody1x1 — Font A normal (matches pre-bill / receipt item lines).
func (w *escposWriter) writeBody1x1() {
	w.size(false, false)
	w.bold(false)
	w.underline(false)
}

// writeMasthead2x2Bold — ticket title and table number emphasis only.
func (w *escposWriter) writeMasthead2x2Bold() {
	w.size(true, true)
	w.bold(true)
}

func (w *escposWriter) writeTicketBranding() {
	w.align(0)
	w.writeBody1x1()
	w.text("restaurant")
	w.lf()
}

func (w *escposWriter) writeTicketMasthead(title string) {
	w.writeTicketBranding()
	w.align(1)
	w.writeMasthead2x2Bold()
	w.text(title)
	w.lf()
	w.separator('-')
}

// writeTableContext prints table no. (2×2 bold) and optional meta lines at body size.
func (w *escposWriter) writeTableContext(p jobPayload, lab ticketLabels, tableCentered bool, metaLines ...string) {
	if tableCentered {
		w.align(1)
	} else {
		w.align(0)
	}
	w.writeMasthead2x2Bold()
	if line := p.tableNoLabel(lab); line != "" {
		w.text(line)
		w.lf()
	}
	w.writeBody1x1()
	w.align(0)
	for _, line := range metaLines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		w.text(line)
		w.lf()
	}
}

// escposItemNotePrefix — label before underlined guest note on station + receipt tickets.
const escposItemNotePrefix = "Observação: "

func (w *escposWriter) writeItemNoteLine(note string, width int) {
	note = strings.TrimSpace(note)
	if note == "" {
		return
	}
	w.writeBody1x1()
	indent := strings.Repeat(" ", escposNoteIndentSpaces)
	line := escposItemNotePrefix + note
	w.underline(true)
	w.text(indent + truncateRunes(line, width-escposNoteIndentSpaces))
	w.lf()
	w.underline(false)
}

func sortStationMenuLines(lines []jobLine) []jobLine {
	out := append([]jobLine(nil), lines...)
	sort.SliceStable(out, func(i, j int) bool {
		a, b := out[i], out[j]
		if a.CategoryGroupSort != b.CategoryGroupSort {
			return a.CategoryGroupSort < b.CategoryGroupSort
		}
		return a.ItemIndex < b.ItemIndex
	})
	return out
}

// writeStationSlipHeader — branding, title, table context, Items/Qty column header (standard size).
func (w *escposWriter) writeStationSlipHeader(p jobPayload, lab ticketLabels) {
	w.writeTicketMasthead(lab.guestOrder)
	var meta []string
	if p.GuestCount > 0 {
		meta = append(meta, fmt.Sprintf("%s:%d", lab.guest, p.GuestCount))
	}
	w.writeTableContext(p, lab, false, meta...)
	w.separator('-')
	w.text(escposPadLine(lab.items, lab.qty, escposWidth))
	w.lf()
}

// writeStationMenuLines — kitchen menu body; Font A 1×1 (same density as pre-bill items).
func (w *escposWriter) writeStationMenuLines(lines []jobLine) {
	w.writeBody1x1()
	lastGroupHeader := ""
	for _, ln := range sortStationMenuLines(lines) {
		groupHeader := strings.TrimSpace(ln.CategoryGroupHeader)
		if groupHeader != "" && groupHeader != lastGroupHeader {
			w.text(strings.Repeat(" ", escposTabWidth) + truncateRunes(groupHeader, escposWidth-escposTabWidth))
			w.lf()
			lastGroupHeader = groupHeader
		}

		label := strings.TrimSpace(ln.DisplayName)
		if label == "" {
			label = formatItemLabel(ln.ItemIndex, "")
		}
		qty := ln.Qty
		if qty <= 0 {
			qty = 1
		}
		w.text(escposPadLine(label, fmt.Sprintf("%d", qty), escposWidth))
		w.lf()
		w.writeItemNoteLine(ln.Note, escposWidth)
	}
}

func (w *escposWriter) writeStationSlipFooter(p jobPayload, lab ticketLabels) {
	w.separator('-')
	orderAt := strings.TrimSpace(p.OrderTime)
	if orderAt == "" {
		orderAt = nowLocal()
	}
	w.text(fmt.Sprintf("%s:%s", lab.orderTime, orderAt))
	w.lf()
	w.text(fmt.Sprintf("%s:%s", lab.printedBy, lab.printedByVal))
	w.lf()
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

type receiptLineFields struct {
	label     string
	qtyCol    string
	priceCol  string
	lineTotal float64
	hasPrice  bool
}

func receiptLineFieldsFrom(ln jobLine) receiptLineFields {
	qty := ln.Qty
	if qty <= 0 {
		qty = 1
	}
	label := strings.TrimSpace(ln.DisplayName)
	lineTotal := ln.UnitPrice * float64(qty)
	qtyCol := fmt.Sprintf("%d", qty)
	if shareLabel := strings.TrimSpace(ln.ShareQtyLabel); shareLabel != "" {
		qtyCol = shareLabel
		lineTotal = ln.UnitPrice
	}
	priceCol := ""
	hasPrice := false
	if ln.UnitPrice > 0 {
		hasPrice = true
		priceCol = formatMoney(lineTotal)
	}
	return receiptLineFields{
		label:     label,
		qtyCol:    qtyCol,
		priceCol:  priceCol,
		lineTotal: lineTotal,
		hasPrice:  hasPrice,
	}
}

func (w *escposWriter) writeReceiptMenuLines(lines []jobLine, lab ticketLabels) (sum float64, hasPrice bool) {
	w.writeBody1x1()
	w.text(escposThreeColLine(lab.items, lab.qty, lab.originalPrice))
	w.lf()
	for _, ln := range lines {
		fields := receiptLineFieldsFrom(ln)
		if fields.hasPrice {
			hasPrice = true
			sum += fields.lineTotal
		}
		w.text(escposThreeColLine(fields.label, fields.qtyCol, fields.priceCol))
		w.lf()
		w.writeItemNoteLine(ln.Note, escposWidth)
		w.lf()
	}
	return sum, hasPrice
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
		return buildOrderReceipt(p, receiptLabelsFor(p.Locale), withPayment, variant)
	case "pre_bill":
		p.ReceiptVariant = "pre_bill"
		return buildOrderReceipt(p, receiptLabelsFor(p.Locale), false, "pre_bill")
	default:
		return buildStationTicket(p)
	}
}

// buildStationTicket — internal station slip; English layout by default, Chinese when locale is zh.
func buildStationTicket(p jobPayload) []byte {
	lab := stationTicketLabels()
	if localeUsesGBK(p.Locale) {
		lab = labelsFor("zh")
	}
	w := newEscposForStationTicket(p)
	w.writeStationSlipHeader(p, lab)
	w.writeStationMenuLines(p.Lines)
	w.writeStationSlipFooter(p, lab)
	return w.finish(true)
}

// buildOrderReceipt — checkout / pre-bill / split-payment / final (English layout per sample).
func buildOrderReceipt(p jobPayload, lab ticketLabels, withPayment bool, variant string) []byte {
	w := newEscposForReceiptTicket(p)
	isSplit := variant == "split_payment"
	payer := formatSplitPayerForReceipt(p.PayerName)

	w.writeTicketMasthead(receiptHeaderTitle(variant, lab))
	var meta []string
	if isSplit && payer != "" {
		meta = append(meta, fmt.Sprintf("%s:%s", lab.guest, payer))
	} else if p.GuestCount > 0 {
		meta = append(meta, fmt.Sprintf("%s:%d", lab.guest, p.GuestCount))
	}
	w.writeTableContext(p, lab, true, meta...)
	w.separator('-')

	var sum float64
	hasPrice := false
	if len(p.Lines) > 0 {
		sum, hasPrice = w.writeReceiptMenuLines(p.Lines, lab)
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
	// GBK / UNYKA USB: plain FS & + GBK bytes — FS ! / GS ! / ESC E often garble Han on clone firmware.
	if w.enc == paperEncGBK {
		w.text(lab.connectionTest)
	} else {
		w.bold(true)
		w.size(true, true)
		w.text(lab.connectionTest)
		w.size(false, false)
		w.bold(false)
	}
	w.lf()
	w.separator('-')
	w.align(0)
	w.text(p.venueName())
	w.lf()
	w.text(nowLocal())
	w.lf()
	return w.finish(true)
}
