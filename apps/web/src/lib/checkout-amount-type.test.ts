import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { CHECKOUT_ACTION_AMOUNT_CLASS } from './checkout-amount-type';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const ACTION_AMOUNT_CALL_SITES = [
  'components/dashboard/checkout/CheckoutRequestListCard.tsx',
  'components/dashboard/checkout/CheckoutRequestDetail.tsx',
  'components/dashboard/checkout/CollectPaymentModal.tsx',
  'components/dashboard/checkout/StaffByItemSplitWorkbench.tsx',
] as const;

describe('CHECKOUT_ACTION_AMOUNT_CLASS', () => {
  it('is the sole checkout action-money face (gold + lg + semibold + tabular)', () => {
    assert.match(CHECKOUT_ACTION_AMOUNT_CLASS, /text-brand-gold/);
    assert.match(CHECKOUT_ACTION_AMOUNT_CLASS, /\bfont-semibold\b/);
    assert.match(CHECKOUT_ACTION_AMOUNT_CLASS, /\btext-lg\b/);
    assert.match(CHECKOUT_ACTION_AMOUNT_CLASS, /tabular-nums/);
    assert.doesNotMatch(
      CHECKOUT_ACTION_AMOUNT_CLASS,
      /mesa-money|font-heading|text-\[22px\]|text-brand-ink/,
    );
  });

  it('is the only action-money class at checkout call sites (no parallel text-base/lg gold)', () => {
    for (const rel of ACTION_AMOUNT_CALL_SITES) {
      const src = readFileSync(join(root, rel), 'utf8');
      assert.match(src, /CHECKOUT_ACTION_AMOUNT_CLASS/, `${rel} must import sole token`);
      assert.doesNotMatch(
        src,
        /text-brand-gold font-semibold(?: tabular-nums)? text-(?:base|lg) tabular-nums|text-brand-gold font-semibold text-(?:base|lg) tabular-nums/,
        `${rel} must not hand-roll parallel action amount classes`,
      );
    }
    const messages = readFileSync(join(root, 'lib/i18n/messages.ts'), 'utf8');
    assert.match(messages, /staffByItemEstimateMeta:/);
    assert.doesNotMatch(messages, /staffByItemEstimate:/);
    assert.doesNotMatch(messages, /staffByItemEstimateMeta:.*€\{amount\}/);
  });
});
