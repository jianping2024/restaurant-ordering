import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseDishFeedbackReasons,
  isDishFeedbackReasonKey,
  parseDishFeedbackSubmitItems,
} from '@/lib/dish-feedback-reasons';

const MENU_A = '11111111-1111-4111-8111-111111111111';
const ORDER_A = '22222222-2222-4222-8222-222222222222';

describe('dish-feedback-reasons', () => {
  it('accepts known keys only', () => {
    assert.equal(isDishFeedbackReasonKey('taste'), true);
    assert.equal(isDishFeedbackReasonKey('nope'), false);
    assert.deepEqual(parseDishFeedbackReasons(['taste', 'taste', 'x', 'slow']), [
      'taste',
      'slow',
    ]);
  });
});

describe('parseDishFeedbackSubmitItems', () => {
  it('accepts up/down rows', () => {
    const r = parseDishFeedbackSubmitItems([
      { menu_item_id: MENU_A, order_id: ORDER_A, vote: 'up', reasons: ['taste'] },
      {
        menu_item_id: '33333333-3333-4333-8333-333333333333',
        order_id: ORDER_A,
        vote: 'down',
        reasons: ['slow', 'bogus'],
      },
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.items[0]?.reasons.length, 0);
    assert.deepEqual(r.items[1]?.reasons, ['slow']);
  });

  it('rejects empty or bad uuid', () => {
    assert.equal(parseDishFeedbackSubmitItems([]).ok, false);
    assert.equal(
      parseDishFeedbackSubmitItems([
        { menu_item_id: 'x', order_id: ORDER_A, vote: 'up' },
      ]).ok,
      false,
    );
  });
});
