/**
 * Sole sticker face for preview / print / ZIP.
 * Physical target: aluminum plate 50mm × 55mm (W×H). Design: 8px = 1mm.
 * Stack: desk # → divider → QR → restaurant name.
 */
export const TABLE_QR_PLATE_MM = {
  widthMm: 50,
  heightMm: 55,
  /** Scan-first with side quiet margin — ~74% of plate width. */
  qrMm: 37,
  sideMarginMm: 6.5,
  paddingTopMm: 2,
  paddingBottomMm: 2.5,
  /** Desk number + divider above the QR. */
  headerBandMm: 7.5,
  /** Restaurant name below the QR. */
  footerBandMm: 6,
} as const;

export const TABLE_QR_PX_PER_MM = 8;

export const TABLE_QR_CARD_LAYOUT = {
  width: TABLE_QR_PLATE_MM.widthMm * TABLE_QR_PX_PER_MM,
  height: TABLE_QR_PLATE_MM.heightMm * TABLE_QR_PX_PER_MM,
  paddingX: TABLE_QR_PLATE_MM.sideMarginMm * TABLE_QR_PX_PER_MM,
  paddingTop: TABLE_QR_PLATE_MM.paddingTopMm * TABLE_QR_PX_PER_MM,
  paddingBottom: TABLE_QR_PLATE_MM.paddingBottomMm * TABLE_QR_PX_PER_MM,
  qrSize: TABLE_QR_PLATE_MM.qrMm * TABLE_QR_PX_PER_MM,
  headerBand: TABLE_QR_PLATE_MM.headerBandMm * TABLE_QR_PX_PER_MM,
  footerBand: TABLE_QR_PLATE_MM.footerBandMm * TABLE_QR_PX_PER_MM,
  borderRadius: 12,
  backgroundColor: '#fbf5eb',
  displayNameColor: '#8e660b',
  /** Fits the header band above the QR on a 50×55 face. */
  displayNameFontSize: 40,
  displayNameFontSizeMin: 24,
  displayNameLineHeight: 1.02,
  displayNameFontWeight: 600,
  displayNameFontFamily:
    '"Jost", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  restaurantNameColor: '#2c2416',
  restaurantNameFontSize: 16,
  restaurantNameFontSizeMin: 11,
  restaurantNameLineHeight: 1.15,
  restaurantNameFontWeight: 600,
  restaurantNameFontFamily:
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Jost", sans-serif',
  dividerLineWidth: 52,
  dividerGap: 14,
  dividerDiamondSize: 4,
  dividerColor: '#c4a35a',
} as const;

/** Sticker face only — one content shape for preview / print / ZIP. */
export type TableQrCardContent = {
  displayName: string;
  restaurantName: string;
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
  return layout.headerBand;
}

/** Vertical space below the QR (restaurant name). */
export function tableQrFooterBandHeight(layout = TABLE_QR_CARD_LAYOUT): number {
  return layout.footerBand;
}
