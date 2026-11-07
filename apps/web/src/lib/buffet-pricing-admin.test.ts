import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { BuffetPriceRule } from '@/types';
import {
  buildBuffetRuleDraft,
  buffetRuleToDraft,
  getRuleStatus,
  ruleCoversDate,
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

  it('defaults to open-ended valid_to', () => {
    const draft = buildBuffetRuleDraft([buffet], [slot]);
    assert.ok(draft);
    assert.equal(draft.valid_to, '');
    assert.ok(draft.valid_from);
  });
});

describe('validateBuffetRuleDraft', () => {
  it('rejects missing start date only', () => {
    const draft = buildBuffetRuleDraft([buffet], [slot], { valid_from: '' })!;
    const result = validateBuffetRuleDraft(draft, []);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'date_required');
  });

  it('allows empty end date (long-term)', () => {
    const draft = buildBuffetRuleDraft([buffet], [slot], { valid_to: '' })!;
    const result = validateBuffetRuleDraft(draft, []);
    assert.equal(result.ok, true);
  });

  it('detects overlapping active rules including open-ended', () => {
    const draft = buffetRuleToDraft(rule({ valid_to: null }));
    const result = validateBuffetRuleDraft(draft, [rule({ valid_to: null })]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.reason, 'conflict');
  });

  it('allows save when skipConflict is set', () => {
    const draft = buffetRuleToDraft(rule());
    const result = validateBuffetRuleDraft(draft, [rule()], { skipConflict: true });
    assert.equal(result.ok, true);
  });
});

describe('ruleCoversDate / getRuleStatus', () => {
  it('open-ended rule covers dates after start', () => {
    const open = rule({ valid_from: '2026-01-01', valid_to: null, is_active: true });
    assert.equal(ruleCoversDate(open, '2026-06-01'), true);
    assert.equal(ruleCoversDate(open, '2025-12-31'), false);
    assert.equal(getRuleStatus(open, '2026-11-07'), 'active');
  });

  it('expired only when end date is past', () => {
    const ended = rule({ valid_from: '2026-01-01', valid_to: '2026-06-01', is_active: true });
    assert.equal(getRuleStatus(ended, '2026-11-07'), 'expired');
  });
});
