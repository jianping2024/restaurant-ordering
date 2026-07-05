export const TABLE_QR_CARD_LAYOUT = {
  width: 400,
  padding: 24,
  borderRadius: 8,
  borderColor: '#dddddd',
  backgroundColor: '#ffffff',
  displayNameColor: '#0f0e0c',
  groupNameColor: '#666666',
  restaurantNameColor: '#444444',
  displayNameFontSize: 42,
  displayNameFontSizeMin: 22,
  groupNameFontSize: 18,
  restaurantNameFontSize: 13,
  qrSize: 280,
  lineGap: 8,
  sectionGap: 14,
  fontFamily: 'Georgia, "Times New Roman", serif',
} as const;

export type TableQrCardContent = {
  displayName: string;
  groupName: string;
  restaurantName: string;
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
    + layout.displayNameFontSize * 1.1
    + layout.lineGap
    + layout.groupNameFontSize * 1.2
    + layout.sectionGap
    + layout.qrSize
    + layout.sectionGap
    + layout.restaurantNameFontSize * 1.4
  );
}
