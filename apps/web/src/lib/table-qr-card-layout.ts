export const TABLE_QR_CARD_LAYOUT = {
  width: 400,
  padding: 28,
  borderRadius: 12,
  borderColor: '#9b2c2c',
  innerBorderColor: '#c4a35a',
  backgroundColor: '#fbf5eb',
  displayNameColor: '#8e660b',
  restaurantNameColor: '#2c2416',
  productNameColor: '#8e660b',
  scanCtaColor: '#9b2c2c',
  displayNameFontSize: 54,
  displayNameFontSizeMin: 28,
  displayNameLineHeight: 1.02,
  displayNameFontWeight: 600,
  displayNameFontFamily:
    '"Jost", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  restaurantNameFontSize: 22,
  restaurantNameFontSizeMin: 16,
  restaurantNameLineHeight: 1.2,
  restaurantNameFontWeight: 600,
  restaurantNameFontFamily:
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Jost", sans-serif',
  productNameFontSize: 16,
  productNameFontSizeMin: 12,
  productNameLineHeight: 1.2,
  productNameFontWeight: 500,
  productNameFontFamily: '"Jost", sans-serif',
  scanCtaFontSize: 20,
  scanCtaFontSizeMin: 14,
  scanCtaLineHeight: 1.15,
  scanCtaFontWeight: 500,
  scanCtaFontFamily: '"Jost", sans-serif',
  qrSize: 268,
  topSectionGap: 16,
  bottomSectionGap: 14,
  brandStackGap: 6,
  scanCtaSectionGap: 16,
  dividerLineWidth: 52,
  dividerGap: 14,
  dividerDiamondSize: 4,
  cornerOrnamentInset: 14,
  cornerOrnamentSize: 14,
  sideOrnamentInset: 10,
  sideOrnamentOffsetY: 164,
  sideOrnamentHeight: 168,
  sideOrnamentDotRadius: 2.5,
  sideOrnamentAccentRadius: 3.5,
} as const;

/** Sticker face only — one content shape for preview / print / ZIP. */
export type TableQrCardContent = {
  displayName: string;
  restaurantName: string;
  productName: string;
  scanCta: string;
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

export function estimateTableQrCardHeight(layout = TABLE_QR_CARD_LAYOUT): number {
  return (
    layout.padding * 2
    + layout.displayNameFontSize * layout.displayNameLineHeight
    + layout.topSectionGap
    + layout.qrSize
    + layout.bottomSectionGap
    + layout.restaurantNameFontSize * layout.restaurantNameLineHeight
    + layout.brandStackGap
    + layout.productNameFontSize * layout.productNameLineHeight
    + layout.scanCtaSectionGap
    + layout.scanCtaFontSize * layout.scanCtaLineHeight
  );
}
