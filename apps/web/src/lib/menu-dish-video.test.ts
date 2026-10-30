import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DISH_VIDEO_ENCODE_TIERS,
  DISH_VIDEO_EFFECT_MESSAGE_KEYS,
  DISH_VIDEO_EFFECTS,
  DISH_VIDEO_MAX_BYTES,
  dishVideoDeviceAllows,
  dishVideoObjectPath,
  isDishVideoEffect,
  menuItemEligibleForDishVideoBatch,
  pickDishVideoTierWithinCap,
  stripMenuItemVideoFields,
} from './menu-dish-video';
import {
  applyDishMotionVideoElementSrc,
  dishMotionCoversStill,
  dishMotionVideoShouldPlay,
} from './menu-dish-video-playback';
import { MENU_IMAGE_MAX_BYTES } from './menu-image';

describe('dish video catalog', () => {
  it('accepts only the six DB-checked effects', () => {
    for (const e of ['push', 'steam', 'gloss', 'pan', 'bubbles', 'frost']) assert.equal(isDishVideoEffect(e), true);
    for (const e of ['none', '', 'zoom', null, 3]) assert.equal(isDishVideoEffect(e), false);
  });

  it('maps every effect to one message key pair (form + batch panel)', () => {
    for (const e of DISH_VIDEO_EFFECTS) {
      assert.ok(DISH_VIDEO_EFFECT_MESSAGE_KEYS[e].label.startsWith('dishVideoEffect'));
      assert.ok(DISH_VIDEO_EFFECT_MESSAGE_KEYS[e].hint.endsWith('Hint'));
    }
  });

  it('batch eligibility is has photo and no video', () => {
    assert.equal(menuItemEligibleForDishVideoBatch({ image_url: 'p', video_url: null }), true);
    assert.equal(menuItemEligibleForDishVideoBatch({ image_url: 'p', video_url: 'v' }), false);
    assert.equal(menuItemEligibleForDishVideoBatch({ image_url: null, video_url: null }), false);
    assert.equal(menuItemEligibleForDishVideoBatch({ image_url: '', video_url: null }), false);
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

  it('plays only when on screen, tab visible, and rail yields to open detail', () => {
    assert.equal(
      dishMotionVideoShouldPlay({
        intersecting: true,
        pageVisible: true,
        layer: 'rail',
        detailOpen: false,
      }),
      true,
    );
    assert.equal(
      dishMotionVideoShouldPlay({
        intersecting: true,
        pageVisible: true,
        layer: 'rail',
        detailOpen: true,
      }),
      false,
    );
    assert.equal(
      dishMotionVideoShouldPlay({
        intersecting: true,
        pageVisible: true,
        layer: 'detail',
        detailOpen: true,
      }),
      true,
    );
    assert.equal(
      dishMotionVideoShouldPlay({
        intersecting: false,
        pageVisible: true,
        layer: 'detail',
        detailOpen: true,
      }),
      false,
    );
    assert.equal(
      dishMotionVideoShouldPlay({
        intersecting: true,
        pageVisible: false,
        layer: 'rail',
        detailOpen: false,
      }),
      false,
    );
  });

  it('covers the still only when motion is allowed, not failed, and ready', () => {
    assert.equal(dishMotionCoversStill({ allowed: true, failed: false, ready: true }), true);
    assert.equal(dishMotionCoversStill({ allowed: true, failed: false, ready: false }), false);
    assert.equal(dishMotionCoversStill({ allowed: false, failed: false, ready: true }), false);
    assert.equal(dishMotionCoversStill({ allowed: true, failed: true, ready: true }), false);
  });

  it('resyncs video element src when the catalog URL changes', () => {
    let attr: string | null = null;
    const video = {
      getAttribute: (name: string) => (name === 'src' ? attr : null),
      setAttribute: (name: string, value: string) => {
        if (name === 'src') attr = value;
      },
    };
    assert.equal(applyDishMotionVideoElementSrc(video, '/a-rail.mp4'), true);
    assert.equal(attr, '/a-rail.mp4');
    assert.equal(applyDishMotionVideoElementSrc(video, '/a-rail.mp4'), false);
    assert.equal(applyDishMotionVideoElementSrc(video, '/b-rail.mp4'), true);
    assert.equal(attr, '/b-rail.mp4');
  });
});
