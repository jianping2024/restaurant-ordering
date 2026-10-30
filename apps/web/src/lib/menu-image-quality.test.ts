import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assessMenuImageQuality,
  laplacianVariance,
  MENU_IMAGE_LONG_EDGE_MIN,
  MENU_IMAGE_SHARPNESS_MIN,
  menuImageNeedsEnhance,
} from './menu-image-quality';

function checkerboard(w: number, h: number, cell: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g[y * w + x] = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? 200 : 40;
  return g;
}

describe('menu image quality', () => {
  it('scores hard edges above soft gradients', () => {
    const sharp = laplacianVariance(checkerboard(64, 48, 4), 64, 48);
    const soft = new Float32Array(64 * 48);
    for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) soft[y * 64 + x] = 60 + x;
    assert.ok(sharp > MENU_IMAGE_SHARPNESS_MIN);
    assert.ok(laplacianVariance(soft, 64, 48) < MENU_IMAGE_SHARPNESS_MIN);
  });

  it('ignores flat white letterbox', () => {
    assert.equal(laplacianVariance(new Float32Array(64 * 48).fill(255), 64, 48), 0);
  });

  it('flags low resolution and blur independently', () => {
    const small = assessMenuImageQuality(267, 200, 900);
    assert.equal(small.lowRes, true);
    assert.equal(small.blurry, false);
    assert.equal(menuImageNeedsEnhance(small), true);
    const ok = assessMenuImageQuality(MENU_IMAGE_LONG_EDGE_MIN, 600, MENU_IMAGE_SHARPNESS_MIN);
    assert.equal(menuImageNeedsEnhance(ok), false);
    assert.equal(menuImageNeedsEnhance(assessMenuImageQuality(1280, 960, 50)), true);
  });
});
