import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPeerFloatLabel,
  resolvePeerFloatThumb,
} from '@/lib/table-order-round/sushi-peer-float-display';

describe('resolvePeerFloatThumb', () => {
  it('prefers catalog emoji and keeps image_url', () => {
    assert.deepEqual(
      resolvePeerFloatThumb({
        menu: { image_url: 'https://example.com/a.jpg', emoji: '🐟' },
        fallbackEmoji: '🍽️',
      }),
      { imageUrl: 'https://example.com/a.jpg', emoji: '🐟' },
    );
  });

  it('uses fallback emoji when catalog missing', () => {
    assert.deepEqual(resolvePeerFloatThumb({ menu: undefined, fallbackEmoji: '🍣' }), {
      imageUrl: undefined,
      emoji: '🍣',
    });
  });

  it('defaults to plate when neither catalog nor fallback', () => {
    assert.deepEqual(resolvePeerFloatThumb({ menu: undefined }), {
      imageUrl: undefined,
      emoji: '🍽️',
    });
  });
});

describe('formatPeerFloatLabel', () => {
  it('is name × qty with no emoji', () => {
    assert.equal(
      formatPeerFloatLabel(
        { name_pt: 'Salmão', name_zh: '三文鱼', name_en: 'Salmon' },
        2,
        'zh',
      ),
      '三文鱼 × 2',
    );
    assert.equal(formatPeerFloatLabel({ name_pt: 'Salmão' }, 1, 'pt'), 'Salmão × 1');
  });
});
