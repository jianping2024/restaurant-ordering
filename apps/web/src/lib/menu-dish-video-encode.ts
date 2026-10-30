/**
 * Browser-only dish motion-video encoder (Pro `menu_dish_video`).
 * Draws the dish photo with a periodic motion template frame by frame, encodes H.264 via
 * WebCodecs and muxes mp4 (`mp4-muxer`, loaded on demand). Every motion is periodic in
 * the clip length, so the loop is seamless. Each variant walks its tier ladder until the
 * file fits {@link DISH_VIDEO_MAX_BYTES}.
 */
import {
  DISH_VIDEO_DURATION_SECONDS,
  DISH_VIDEO_ENCODE_TIERS,
  DISH_VIDEO_FPS,
  DISH_VIDEO_MAX_BYTES,
  DISH_VIDEO_MIME,
  pickDishVideoTierWithinCap,
  type DishVideoEffect,
  type DishVideoEncodeTier,
  type DishVideoVariant,
} from '@/lib/menu-dish-video';

const FRAMES = DISH_VIDEO_FPS * DISH_VIDEO_DURATION_SECONDS;
/** Logical drawing space; each tier scales it to its own pixel size. */
const LW = 640;
const LH = 480;

export type DishVideoResult = {
  detail: Blob;
  rail: Blob;
};

export function dishVideoEncodingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.VideoEncoder === 'function' &&
    typeof window.VideoFrame === 'function'
  );
}

type SubjectBox = { x: number; y: number; w: number; h: number; lightBg: boolean };

/** Bounding box of the non-white subject (menu photos are letterboxed on white). */
function subjectBox(source: ImageBitmap): SubjectBox {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 48;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { x: 0, y: 0, w: 1, h: 1, lightBg: false };
  ctx.drawImage(source, 0, 0, 64, 48);
  const d = ctx.getImageData(0, 0, 64, 48).data;
  let x0 = 64;
  let y0 = 48;
  let x1 = -1;
  let y1 = -1;
  let light = 0;
  for (let y = 0; y < 48; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4;
      if (d[i] > 232 && d[i + 1] > 232 && d[i + 2] > 232) light++;
      else {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1, lightBg: true };
  return { x: x0 / 64, y: y0 / 48, w: (x1 - x0 + 1) / 64, h: (y1 - y0 + 1) / 48, lightBg: light / 3072 > 0.3 };
}

type Particles = {
  steam: { x: number; phase: number; r: number; sway: number; speed: number }[];
  bubbles: { x: number; phase: number; r: number; speed: number; wob: number }[];
  stars: { x: number; y: number; phase: number; size: number }[];
};

function makeParticles(seed: number): Particles {
  let s = seed % 233280;
  const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  return {
    steam: Array.from({ length: 22 }, () => ({ x: r(), phase: r(), r: 30 + r() * 50, sway: 8 + r() * 20, speed: r() < 0.5 ? 1 : 2 })),
    bubbles: Array.from({ length: 34 }, () => ({ x: r(), phase: r(), r: 1.5 + r() * 3.5, speed: 1 + Math.floor(r() * 3), wob: r() * 6 })),
    stars: Array.from({ length: 7 }, () => ({ x: 0.1 + r() * 0.8, y: 0.1 + r() * 0.8, phase: r(), size: 8 + r() * 10 })),
  };
}

/** Draw frame at loop phase p ∈ [0,1) in LW×LH logical space scaled by k. */
function renderFrame(
  ctx: CanvasRenderingContext2D,
  k: number,
  img: ImageBitmap,
  effect: DishVideoEffect,
  p: number,
  fx: Particles,
  box: SubjectBox,
) {
  const TAU = Math.PI * 2;
  const wave = Math.sin(p * TAU);
  const ease = 0.5 - 0.5 * Math.cos(p * TAU);
  const s = Math.min(LW / img.width, LH / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  const ox = (LW - dw) / 2;
  const oy = (LH - dh) / 2;
  const bx = ox + box.x * dw;
  const by = oy + box.y * dh;
  const bw = box.w * dw;
  const bh = box.h * dh;
  const fcx = bx + bw / 2;
  const fcy = by + bh / 2;

  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LW, LH);
  let zoom = 1 + 0.07 * ease;
  let dx = 0;
  let dy = 0;
  if (effect === 'pan') {
    zoom = 1.12;
    dx = wave * 30;
    dy = Math.cos(p * TAU) * 6;
  }
  ctx.translate(fcx + dx, fcy + dy);
  ctx.scale(zoom, zoom);
  ctx.translate(-fcx, -fcy);
  ctx.drawImage(img, ox, oy, dw, dh);
  if (!box.lightBg) {
    ctx.fillStyle = 'rgba(255,170,80,0.05)';
    ctx.fillRect(ox, oy, dw, dh);
  }

  if (effect === 'steam') {
    ctx.save();
    ctx.globalCompositeOperation = box.lightBg ? 'multiply' : 'screen';
    for (const q of fx.steam) {
      const t = (p * q.speed + q.phase) % 1;
      const x = bx + bw * (0.3 + q.x * 0.4) + Math.sin((t + q.phase) * Math.PI * 4) * q.sway;
      const y = by + bh * 0.45 - t * bh * 0.9;
      const a = Math.sin(t * Math.PI) * (box.lightBg ? 0.1 : 0.16);
      const g = ctx.createRadialGradient(x, y, 0, x, y, q.r * (0.6 + t));
      g.addColorStop(0, box.lightBg ? `rgba(120,110,100,${a})` : `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 150, y - 150, 300, 300);
    }
    ctx.restore();
  } else if (effect === 'gloss') {
    const sweep = p * (LW + 600) - 300;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const g = ctx.createLinearGradient(sweep - 160, 0, sweep + 160, LH * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,240,210,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-100, -100, LW + 200, LH + 200);
    ctx.restore();
  } else if (effect === 'bubbles') {
    for (const q of fx.bubbles) {
      const t = (p * q.speed + q.phase) % 1;
      const x = bx + bw * (0.32 + q.x * 0.36) + Math.sin((t * 3 + q.phase) * TAU) * q.wob;
      const y = by + bh * 0.92 - t * bh * 0.68;
      const a = Math.min(1, Math.sin(t * Math.PI) * 1.6);
      ctx.beginPath();
      ctx.arc(x, y, q.r, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${0.28 * a})`;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,255,255,${0.75 * a})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x - q.r * 0.35, y - q.r * 0.35, q.r * 0.3, 0, TAU);
      ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
      ctx.fill();
    }
  } else if (effect === 'frost') {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(150,200,255,0.35)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const st of fx.stars) {
      const t = (p + st.phase) % 1;
      const a = Math.max(0, Math.sin(t * TAU)) ** 3;
      if (a < 0.02) continue;
      const x = bx + st.x * bw;
      const y = by + st.y * bh;
      const r = st.size * (0.6 + 0.4 * a);
      ctx.fillStyle = `rgba(255,255,255,${0.85 * a})`;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r * 0.15, y - r * 0.15);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x + r * 0.15, y + r * 0.15);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r * 0.15, y + r * 0.15);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - r * 0.15, y - r * 0.15);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

async function encodeTier(
  img: ImageBitmap,
  effect: DishVideoEffect,
  tier: DishVideoEncodeTier,
  box: SubjectBox,
): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const canvas = document.createElement('canvas');
  canvas.width = tier.width;
  canvas.height = tier.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas_2d_unavailable');
  ctx.imageSmoothingQuality = 'high';
  const fx = makeParticles(img.width * 31 + img.height);
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width: tier.width, height: tier.height },
    fastStart: 'in-memory',
  });
  let failure: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e;
    },
  });
  encoder.configure({
    codec: 'avc1.42001f',
    width: tier.width,
    height: tier.height,
    bitrate: tier.bitrate,
    bitrateMode: 'constant',
    framerate: DISH_VIDEO_FPS,
  });
  const k = tier.width / LW;
  const frameUs = Math.round(1e6 / DISH_VIDEO_FPS);
  for (let i = 0; i < FRAMES; i++) {
    renderFrame(ctx, k, img, effect, i / FRAMES, fx, box);
    const frame = new VideoFrame(canvas, { timestamp: i * frameUs, duration: frameUs });
    encoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();
    if (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();
  if (failure) throw failure;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: DISH_VIDEO_MIME });
}

async function encodeVariant(
  img: ImageBitmap,
  effect: DishVideoEffect,
  variant: DishVideoVariant,
  box: SubjectBox,
): Promise<Blob> {
  const sizes: number[] = [];
  for (const tier of DISH_VIDEO_ENCODE_TIERS[variant]) {
    const blob = await encodeTier(img, effect, tier, box);
    sizes.push(blob.size);
    if (pickDishVideoTierWithinCap(sizes) === sizes.length - 1) return blob;
  }
  throw new Error(`dish_video_too_large_${variant}`);
}

/** Encode both guest variants from the (already 4:3 letterboxed) dish photo. */
export async function encodeDishVideos(photo: Blob, effect: DishVideoEffect): Promise<DishVideoResult> {
  if (!dishVideoEncodingSupported()) throw new Error('dish_video_unsupported');
  const img = await createImageBitmap(photo);
  try {
    const box = subjectBox(img);
    const detail = await encodeVariant(img, effect, 'detail', box);
    const rail = await encodeVariant(img, effect, 'rail', box);
    if (detail.size > DISH_VIDEO_MAX_BYTES || rail.size > DISH_VIDEO_MAX_BYTES) {
      throw new Error('dish_video_too_large');
    }
    return { detail, rail };
  } finally {
    img.close();
  }
}
