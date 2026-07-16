export const TABLE_QR_CARD_LAYOUT = {
  width: 400,
  padding: 28,
  borderRadius: 12,
  borderColor: '#d8cbb6',
  innerBorderColor: '#ece1d1',
  backgroundColor: '#fbf7ef',
  displayNameColor: '#8e660b',
  groupNameColor: '#4e4031',
  restaurantNameColor: '#5f5241',
  scanCtaColor: '#8e660b',
  displayNameFontSize: 58,
  displayNameFontSizeMin: 28,
  displayNameLineHeight: 1.02,
  displayNameFontWeight: 600,
  displayNameFontFamily: '"Cormorant Garamond", serif',
  secondaryFontSize: 18,
  secondaryLineHeight: 1.2,
  secondaryFontWeight: 400,
  secondaryFontFamily: '"Jost", sans-serif',
  scanCtaFontSize: 24,
  scanCtaFontSizeMin: 16,
  scanCtaLineHeight: 1.15,
  scanCtaFontWeight: 500,
  scanCtaFontFamily: '"Jost", sans-serif',
  qrSize: 280,
  topSectionGap: 14,
  groupSectionGap: 16,
  bottomSectionGap: 12,
  scanCtaSectionGap: 18,
  dividerLineWidth: 44,
  dividerGap: 14,
  dividerDiamondSize: 4,
  sideOrnamentInset: 10,
  sideOrnamentOffsetY: 172,
  sideOrnamentHeight: 176,
  sideOrnamentDotRadius: 3,
  sideOrnamentAccentRadius: 4,
} as const;

export type TableQrCardContent = {
  displayName: string;
  groupName: string;
  restaurantName: string;
  scanCta: string;
  qrDataUrl: string;
};

export function resolveTableQrGroupLabel(
  tableId: string,
  groupNameByTableId: Record<string, string>,
  ungroupedLabel: string,
): string {
  return groupNameByTableId[tableId]?.trim() || ungroupedLabel;
}

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
    + layout.secondaryFontSize * layout.secondaryLineHeight
    + layout.groupSectionGap
    + layout.qrSize
    + layout.bottomSectionGap
    + layout.secondaryFontSize * layout.secondaryLineHeight
    + layout.scanCtaSectionGap
    + layout.scanCtaFontSize * layout.scanCtaLineHeight
  );
}
