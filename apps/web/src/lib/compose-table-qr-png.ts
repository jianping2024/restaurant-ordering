import {
  estimateTableQrCardHeight,
  fitSingleLineFontSize,
  TABLE_QR_CARD_LAYOUT,
  type TableQrCardContent,
} from '@/lib/table-qr-card-layout';

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

export async function composeTableQrPng(content: TableQrCardContent): Promise<string> {
  const layout = TABLE_QR_CARD_LAYOUT;
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
      ctx.font = `700 ${fontSize}px ${layout.fontFamily}`;
      return ctx.measureText(value).width;
    },
  );
  ctx.font = `700 ${displayFontSize}px ${layout.fontFamily}`;
  ctx.fillText(content.displayName.trim(), layout.width / 2, y);
  y += displayFontSize * 1.1 + layout.lineGap;

  ctx.fillStyle = layout.groupNameColor;
  ctx.font = `${layout.groupNameFontSize}px ${layout.fontFamily}`;
  ctx.fillText(content.groupName.trim(), layout.width / 2, y);
  y += layout.groupNameFontSize * 1.2 + layout.sectionGap;

  const qrX = (layout.width - layout.qrSize) / 2;
  ctx.drawImage(qrImage, qrX, y, layout.qrSize, layout.qrSize);
  y += layout.qrSize + layout.sectionGap;

  ctx.fillStyle = layout.restaurantNameColor;
  ctx.font = `${layout.restaurantNameFontSize}px ${layout.fontFamily}`;
  ctx.fillText(content.restaurantName.trim(), layout.width / 2, y);

  return canvas.toDataURL('image/png');
}
