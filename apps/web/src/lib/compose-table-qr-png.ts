import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
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

function strokeDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - size);
  ctx.lineTo(centerX + size, centerY);
  ctx.lineTo(centerX, centerY + size);
  ctx.lineTo(centerX - size, centerY);
  ctx.closePath();
  ctx.stroke();
}

function fillDiamond(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  size: number,
): void {
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - size);
  ctx.lineTo(centerX + size, centerY);
  ctx.lineTo(centerX, centerY + size);
  ctx.lineTo(centerX - size, centerY);
  ctx.closePath();
  ctx.fill();
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
  strokeDiamond(ctx, centerX, centerY, diamondSize);
  ctx.restore();
}

function drawBottomAccent(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(centerX - 32, centerY);
  ctx.lineTo(centerX - 10, centerY);
  ctx.moveTo(centerX + 10, centerY);
  ctx.lineTo(centerX + 32, centerY);
  ctx.stroke();
  strokeDiamond(ctx, centerX, centerY, 3);
  ctx.restore();
}

function drawSideOrnaments(
  ctx: CanvasRenderingContext2D,
  width: number,
  centerY: number,
  color: string,
): void {
  const layout = TABLE_QR_CARD_LAYOUT;
  const leftX = layout.sideOrnamentInset;
  const rightX = width - layout.sideOrnamentInset;
  const topY = centerY - layout.sideOrnamentHeight / 2;
  const bottomY = centerY + layout.sideOrnamentHeight / 2;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1;
  for (const x of [leftX, rightX]) {
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, bottomY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, centerY, layout.sideOrnamentDotRadius, 0, Math.PI * 2);
    ctx.fill();
    fillDiamond(ctx, x, centerY, layout.sideOrnamentAccentRadius);
  }
  ctx.restore();
}

async function ensureTableQrFontsLoaded(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  if (!fontsReady) {
    fontsReady = Promise.all([
      document.fonts.load(`600 58px ${TABLE_QR_CARD_LAYOUT.displayNameFontFamily}`),
      document.fonts.load(`400 18px ${TABLE_QR_CARD_LAYOUT.secondaryFontFamily}`),
      document.fonts.load(`500 24px ${TABLE_QR_CARD_LAYOUT.scanCtaFontFamily}`),
    ]).then(() => undefined);
  }
  await fontsReady;
}

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
  roundedRectPath(ctx, 0, 0, layout.width, height, layout.borderRadius);
  ctx.fill();
  ctx.strokeStyle = layout.borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  roundedRectPath(ctx, 8, 8, layout.width - 16, height - 16, layout.borderRadius - 2);
  ctx.strokeStyle = layout.innerBorderColor;
  ctx.stroke();

  const innerWidth = layout.width - layout.padding * 2;
  let y = layout.padding;

  ctx.fillStyle = layout.displayNameColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
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
  ctx.fillText(content.displayName.trim(), layout.width / 2, y);
  y += displayFontSize * layout.displayNameLineHeight + layout.topSectionGap;

  ctx.fillStyle = layout.groupNameColor;
  ctx.font = `${layout.secondaryFontWeight} ${layout.secondaryFontSize}px ${layout.secondaryFontFamily}`;
  ctx.fillText(content.groupName.trim(), layout.width / 2, y);
  drawDivider(
    ctx,
    layout.width / 2,
    y + layout.secondaryFontSize * layout.secondaryLineHeight / 2,
    layout.dividerLineWidth,
    layout.dividerGap,
    layout.dividerDiamondSize,
    layout.innerBorderColor,
  );
  y += layout.secondaryFontSize * layout.secondaryLineHeight + layout.groupSectionGap;

  const qrX = (layout.width - layout.qrSize) / 2;
  ctx.drawImage(qrImage, qrX, y, layout.qrSize, layout.qrSize);
  drawSideOrnaments(
    ctx,
    layout.width,
    y + layout.sideOrnamentOffsetY,
    layout.innerBorderColor,
  );
  y += layout.qrSize + layout.bottomSectionGap;

  ctx.fillStyle = layout.restaurantNameColor;
  ctx.font = `${layout.secondaryFontWeight} ${layout.secondaryFontSize}px ${layout.secondaryFontFamily}`;
  ctx.fillText(content.restaurantName.trim(), layout.width / 2, y);
  y += layout.secondaryFontSize * layout.secondaryLineHeight + layout.scanCtaSectionGap;

  drawBottomAccent(ctx, layout.width / 2, y - 9, layout.innerBorderColor);
  ctx.fillStyle = layout.scanCtaColor;
  const scanCtaFontSize = fitSingleLineFontSize(
    content.scanCta,
    innerWidth,
    layout.scanCtaFontSize,
    layout.scanCtaFontSizeMin,
    (value, fontSize) => {
      ctx.font = `${layout.scanCtaFontWeight} ${fontSize}px ${layout.scanCtaFontFamily}`;
      return ctx.measureText(value).width;
    },
  );
  ctx.font = `${layout.scanCtaFontWeight} ${scanCtaFontSize}px ${layout.scanCtaFontFamily}`;
  ctx.fillText(content.scanCta.trim(), layout.width / 2, y);

  return canvas.toDataURL('image/png');
}
