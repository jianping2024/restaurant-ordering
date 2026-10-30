/**
 * Sole menu-photo quality check + free in-browser sharpen (all stores; not Pro).
 * Pure scoring (`laplacianVariance`, `assessMenuImageQuality`) is node-testable;
 * canvas helpers are browser-only and called from the dish form.
 */

/** Below this longest edge (px) the photo looks soft on the guest detail hero. */
export const MENU_IMAGE_LONG_EDGE_MIN = 800;
/** Laplacian variance at {@link SHARPNESS_SAMPLE_WIDTH}px width; below = blurry. */
export const MENU_IMAGE_SHARPNESS_MIN = 120;
const SHARPNESS_SAMPLE_WIDTH = 320;
/** Enhance upscales to the same cap the upload compressor keeps (MENU_IMAGE_MAX_DIMENSION). */
const ENHANCE_TARGET_LONG_EDGE = 1280;

export type MenuImageQuality = {
  width: number;
  height: number;
  sharpness: number;
  lowRes: boolean;
  blurry: boolean;
};

/**
 * Variance of the 4-neighbour Laplacian over a grayscale buffer.
 * Flat near-white pixels (letterbox / studio background) are skipped so a product
 * shot on white is scored by the product, not the empty frame.
 */
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      if (gray[i] > 240 && Math.abs(lap) < 2) continue;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function assessMenuImageQuality(width: number, height: number, sharpness: number): MenuImageQuality {
  return {
    width,
    height,
    sharpness,
    lowRes: Math.max(width, height) < MENU_IMAGE_LONG_EDGE_MIN,
    blurry: sharpness < MENU_IMAGE_SHARPNESS_MIN,
  };
}

export function menuImageNeedsEnhance(quality: MenuImageQuality): boolean {
  return quality.lowRes || quality.blurry;
}

function drawToCanvas(source: CanvasImageSource, width: number, height: number, filter?: string) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('canvas_2d_unavailable');
  ctx.imageSmoothingQuality = 'high';
  if (filter) ctx.filter = filter;
  ctx.drawImage(source, 0, 0, width, height);
  return { canvas, ctx };
}

/** Browser-only: score a decoded photo. */
export function measureMenuImageQuality(bitmap: ImageBitmap): MenuImageQuality {
  const w = SHARPNESS_SAMPLE_WIDTH;
  const h = Math.max(3, Math.round((SHARPNESS_SAMPLE_WIDTH * bitmap.height) / bitmap.width));
  const { ctx } = drawToCanvas(bitmap, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  }
  return assessMenuImageQuality(bitmap.width, bitmap.height, laplacianVariance(gray, w, h));
}

/**
 * Browser-only: upscale to {@link ENHANCE_TARGET_LONG_EDGE} with high-quality smoothing,
 * light contrast/saturation lift, then a conservative unsharp mask. Returns a JPEG file
 * for the normal upload compressor. Cannot invent detail the source never had.
 */
export async function enhanceMenuImageFile(bitmap: ImageBitmap, name: string): Promise<File> {
  const scale = Math.max(1, ENHANCE_TARGET_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const base = drawToCanvas(bitmap, w, h, 'contrast(1.04) saturate(1.08)');
  const blur = drawToCanvas(base.canvas, w, h, `blur(${Math.max(1, scale * 0.9).toFixed(1)}px)`);
  const out = base.ctx.getImageData(0, 0, w, h);
  const blurred = blur.ctx.getImageData(0, 0, w, h).data;
  const px = out.data;
  for (let i = 0; i < px.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const diff = px[i + k] - blurred[i + k];
      if (Math.abs(diff) > 3) px[i + k] = Math.max(0, Math.min(255, px[i + k] + 0.9 * diff));
    }
  }
  base.ctx.putImageData(out, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => base.canvas.toBlob(resolve, 'image/jpeg', 0.92));
  if (!blob) throw new Error('enhance_encode_failed');
  const stem = name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${stem}-enhanced.jpg`, { type: 'image/jpeg' });
}
