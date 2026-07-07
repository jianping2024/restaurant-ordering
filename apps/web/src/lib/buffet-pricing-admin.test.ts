import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BuffetPriceRule } from '@/types';
import {
  buildBuffetRuleDraft,
  buffetRuleToDraft,
  validateBuffetRuleDraft,
} from '@/lib/buffet-pricing-admin';

const buffet = {
  id: 'b1',
  restaurant_id: 'r1',
  name: 'Lunch',
  is_active: true,
  description: null,
  created_at: '',
  updated_at: '',
};

const slot = {
  id: 's1',
  restaurant_id: 'r1',
  name: 'Noon',
  start_time: '12:00:00',
  end_time: '15:00:00',
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  sort_order: 0,
  created_at: '',
};

const rule = (overrides: Partial<BuffetPriceRule> = {}): BuffetPriceRule => ({
  id: 'rule-1',
  restaurant_id: 'r1',
  buffet_id: 'b1',
  time_slot_id: 's1',
  calendar_kind: 'weekday',
  valid_from: '2026-01-01',
  valid_to: '2026-12-31',
  adult_price: 20,
  child_price: 10,
  priority: 0,
  is_active: true,
  note: null,
  created_at: '',
  ...overrides,
});

describe('buildBuffetRuleDraft', () => {
  it('returns null when buffet or slot is missing', () => {
    assert.equal(buildBuffetRuleDraft([], [slot]), null);
    assert.equal(buildBuffetRuleDraft([buffet], []), null);
  });

  it('applies overrides', () => {
    const draft = buildBuffetRuleDraft([buffet], [slot], { calendar_kind: 'weekend' });
    assert.ok(draft);
    assert.equal(draft.calendar_kind, 'weekend');
    assert.equal(draft.buffet_id, 'b1');
  });
});

describe('validateBuffetRuleDraft', () => {
  it('rejects missing dates', () => {
    const draft = buildBuffetRuleDraft([buffet], [slot], { valid_from: '' })!;
    const result = validateBuffetRuleDraft(draft, []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'date_required');
  });

  it('detects overlapping active rules', () => {
    const draft = buffetRuleToDraft(rule());
    const result = validateBuffetRuleDraft(draft, [rule()]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'conflict');
  });

  it('allows save when skipConflict is set', () => {
    const draft = buffetRuleToDraft(rule());
    const result = validateBuffetRuleDraft(draft, [rule()], { skipConflict: true });
    assert.equal(result.ok, true);
  });
});
