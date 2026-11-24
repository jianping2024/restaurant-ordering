/**
 * Sole sticker face for preview / print / ZIP.
 * Physical target: aluminum plate 50mm × 55mm (W×H). Design: 8px = 1mm.
 */
export const TABLE_QR_PLATE_MM = {
  widthMm: 50,
  heightMm: 55,
  /** Scan-first with side quiet margin — ~82% of plate width. */
  qrMm: 41,
  sideMarginMm: 4.5,
  paddingTopMm: 2.5,
  paddingBottomMm: 2.5,
} as const;

export const TABLE_QR_PX_PER_MM = 8;

export const TABLE_QR_CARD_LAYOUT = {
  width: TABLE_QR_PLATE_MM.widthMm * TABLE_QR_PX_PER_MM,
  height: TABLE_QR_PLATE_MM.heightMm * TABLE_QR_PX_PER_MM,
  paddingX: TABLE_QR_PLATE_MM.sideMarginMm * TABLE_QR_PX_PER_MM,
  paddingTop: TABLE_QR_PLATE_MM.paddingTopMm * TABLE_QR_PX_PER_MM,
  paddingBottom: TABLE_QR_PLATE_MM.paddingBottomMm * TABLE_QR_PX_PER_MM,
  qrSize: TABLE_QR_PLATE_MM.qrMm * TABLE_QR_PX_PER_MM,
  borderRadius: 12,
  backgroundColor: '#fbf5eb',
  displayNameColor: '#8e660b',
  /** Fits the header band above the QR on a 50×55 face. */
  displayNameFontSize: 48,
  displayNameFontSizeMin: 28,
  displayNameLineHeight: 1.02,
  displayNameFontWeight: 600,
  displayNameFontFamily:
    '"Jost", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  dividerLineWidth: 52,
  dividerGap: 14,
  dividerDiamondSize: 4,
  dividerColor: '#c4a35a',
} as const;

/** Sticker face only — one content shape for preview / print / ZIP. */
export type TableQrCardContent = {
  displayName: string;
  qrDataUrl: string;
};

export function fitSingleLineFontSize(
  text: string,
  maxWidth: number,
  startSize: number,
  minSize: number,
  measure: (value: string, fontSize: number) => number,
): number {
  const trimmed = text.trim();
  if (!trimmed) return startSize;
  for (let size = startSize; size >= minSize; size -= 1) {
    if (measure(trimmed, size) <= maxWidth) return size;
  }
  return minSize;
}

/** Fixed plate height — do not grow/shrink with font metrics. */
export function estimateTableQrCardHeight(layout = TABLE_QR_CARD_LAYOUT): number {
  return layout.height;
}

/** Vertical space above the QR (desk # + divider). */
export function tableQrHeaderBandHeight(layout = TABLE_QR_CARD_LAYOUT): number {
  return layout.height - layout.paddingTop - layout.paddingBottom - layout.qrSize;
}
