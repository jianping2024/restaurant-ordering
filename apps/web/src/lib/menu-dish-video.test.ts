import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISH_VIDEO_ENCODE_TIERS,
  DISH_VIDEO_MAX_BYTES,
  dishVideoDeviceAllows,
  dishVideoObjectPath,
  isDishVideoEffect,
  pickDishVideoTierWithinCap,
  stripMenuItemVideoFields,
} from './menu-dish-video';
import { MENU_IMAGE_MAX_BYTES } from './menu-image';

describe('dish video catalog', () => {
  it('accepts only the six DB-checked effects', () => {
    for (const e of ['push', 'steam', 'gloss', 'pan', 'bubbles', 'frost']) assert.equal(isDishVideoEffect(e), true);
    for (const e of ['none', '', 'zoom', null, 3]) assert.equal(isDishVideoEffect(e), false);
  });

  it('caps each mp4 at the photo bucket limit', () => {
    assert.equal(DISH_VIDEO_MAX_BYTES, MENU_IMAGE_MAX_BYTES);
  });

  it('detail starts at 960×720 and rail at 480×360, bitrate only goes down the ladder', () => {
    assert.deepEqual([DISH_VIDEO_ENCODE_TIERS.detail[0].width, DISH_VIDEO_ENCODE_TIERS.detail[0].height], [960, 720]);
    assert.deepEqual([DISH_VIDEO_ENCODE_TIERS.rail[0].width, DISH_VIDEO_ENCODE_TIERS.rail[0].height], [480, 360]);
    for (const tiers of Object.values(DISH_VIDEO_ENCODE_TIERS)) {
      for (let i = 1; i < tiers.length; i++) {
        const prev = tiers[i - 1].width * tiers[i - 1].height * tiers[i - 1].bitrate;
        assert.ok(tiers[i].width * tiers[i].height * tiers[i].bitrate <= prev);
      }
    }
  });

  it('picks the first encoded attempt within the cap', () => {
    assert.equal(pickDishVideoTierWithinCap([800_000]), 0);
    assert.equal(pickDishVideoTierWithinCap([1_200_000, 900_000]), 1);
    assert.equal(pickDishVideoTierWithinCap([1_200_000, 1_100_000]), -1);
    assert.equal(pickDishVideoTierWithinCap([0, 500]), 1);
  });

  it('builds a per-upload object path under the restaurant/item folder', () => {
    assert.equal(dishVideoObjectPath('r1', 'm1', 'rail', 'k'), 'r1/m1/k-rail.mp4');
    assert.throws(() => dishVideoObjectPath('r1', 'm1', 'detail', ' '));
  });

  it('strips guest video fields only when present', () => {
    const plain = { id: 'a', video_url: null, rail_video_url: null, video_effect: null };
    assert.equal(stripMenuItemVideoFields(plain), plain);
    assert.deepEqual(stripMenuItemVideoFields({ id: 'b', video_url: 'v', rail_video_url: 'r', video_effect: 'push' }), {
      id: 'b',
      video_url: null,
      rail_video_url: null,
      video_effect: null,
    });
  });

  it('device gate falls back to the photo on reduced motion, data saver and 2G', () => {
    assert.equal(dishVideoDeviceAllows({ reducedMotion: false }), true);
    assert.equal(dishVideoDeviceAllows({ reducedMotion: false, effectiveType: '4g' }), true);
    assert.equal(dishVideoDeviceAllows({ reducedMotion: true }), false);
    assert.equal(dishVideoDeviceAllows({ reducedMotion: false, saveData: true }), false);
    assert.equal(dishVideoDeviceAllows({ reducedMotion: false, effectiveType: '2g' }), false);
    assert.equal(dishVideoDeviceAllows({ reducedMotion: false, effectiveType: 'slow-2g' }), false);
  });
});
