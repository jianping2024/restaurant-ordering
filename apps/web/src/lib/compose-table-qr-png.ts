import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
  tableQrHeaderBandHeight,
  type TableQrCardContent,
} from '@/lib/table-qr-card-layout';

let fontsReady: Promise<void> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('qr_image_load_failed'));
    img.src = src;
  });
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDivider(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  width: number,
  gap: number,
  diamondSize: number,
  color: string,
): void {
  const halfGap = gap / 2;
  const halfWidth = width / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - halfWidth, centerY);
  ctx.lineTo(centerX - halfGap, centerY);
  ctx.moveTo(centerX + halfGap, centerY);
  ctx.lineTo(centerX + halfWidth, centerY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - diamondSize);
  ctx.lineTo(centerX + diamondSize, centerY);
  ctx.lineTo(centerX, centerY + diamondSize);
  ctx.lineTo(centerX - diamondSize, centerY);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

async function ensureTableQrFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  if (!fontsReady) {
    fontsReady = document.fonts
      .load(`600 ${TABLE_QR_CARD_LAYOUT.displayNameFontSize}px ${TABLE_QR_CARD_LAYOUT.displayNameFontFamily}`)
      .then(() => undefined);
  }
  await fontsReady;
}

/** One sticker face: desk number + QR, sized for 50×55mm aluminum plate. */
export async function composeTableQrPng(content: TableQrCardContent): Promise<string> {
  const layout = TABLE_QR_CARD_LAYOUT;
  await ensureTableQrFontsLoaded();
  const qrImage = await loadImage(content.qrDataUrl);
  const height = estimateTableQrCardHeight(layout);
  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = layout.width * dpr;
  canvas.height = height * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_unavailable');

  ctx.scale(dpr, dpr);
  ctx.fillStyle = layout.backgroundColor;
  ctx.fillRect(0, 0, layout.width, height);
  roundedRectPath(ctx, 0, 0, layout.width, height, layout.borderRadius);
  ctx.fill();

  const qrY = height - layout.paddingBottom - layout.qrSize;
  const qrX = (layout.width - layout.qrSize) / 2;
  const headerBand = tableQrHeaderBandHeight(layout);
  const innerWidth = layout.width - layout.paddingX * 2;

  ctx.fillStyle = layout.displayNameColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const displayFontSize = fitSingleLineFontSize(
    content.displayName,
    innerWidth,
    layout.displayNameFontSize,
    layout.displayNameFontSizeMin,
    (value, fontSize) => {
      ctx.font = `${layout.displayNameFontWeight} ${fontSize}px ${layout.displayNameFontFamily}`;
      return ctx.measureText(value).width;
    },
  );
  ctx.font = `${layout.displayNameFontWeight} ${displayFontSize}px ${layout.displayNameFontFamily}`;

  // Desk # + divider centered in the band above the QR.
  const dividerReserve = layout.dividerDiamondSize * 2 + 10;
  const nameCenterY =
    layout.paddingTop + (headerBand - dividerReserve) / 2;
  ctx.fillText(content.displayName.trim(), layout.width / 2, nameCenterY);
  drawDivider(
    ctx,
    layout.width / 2,
    layout.paddingTop + headerBand - dividerReserve / 2,
    layout.dividerLineWidth,
    layout.dividerGap,
    layout.dividerDiamondSize,
    layout.dividerColor,
  );

  ctx.drawImage(qrImage, qrX, qrY, layout.qrSize, layout.qrSize);

  return canvas.toDataURL('image/png');
}
