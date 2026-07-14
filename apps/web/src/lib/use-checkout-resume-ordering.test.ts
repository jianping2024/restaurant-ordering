import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isCheckoutResumeExitComplete,
  resolveCheckoutResumeExitHref,
} from './use-checkout-resume-ordering';

test('resolveCheckoutResumeExitHref targets embedded dashboard table detail', () => {
  const tableId = 'abc-123';
  assert.equal(
    resolveCheckoutResumeExitHref('cafe-lisboa', tableId),
    `/dashboard/waiter/${encodeURIComponent(tableId)}`,
  );
});

test('isCheckoutResumeExitComplete matches exact table detail path', () => {
  const href = '/dashboard/waiter/table-1';
  assert.equal(isCheckoutResumeExitComplete(href, href), true);
  assert.equal(isCheckoutResumeExitComplete('/dashboard/waiter', href), false);
  assert.equal(isCheckoutResumeExitComplete('/dashboard/checkout', href), false);
});
