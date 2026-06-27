import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buffetStripSectionClass,
  waiterDetailLayout,
} from './waiter-table-detail-ui';

test('buffet strip edge sections align to card gutter without ad-hoc padding overrides', () => {
  assert.match(buffetStripSectionClass('start'), /xl:pr-4/);
  assert.doesNotMatch(buffetStripSectionClass('start'), /xl:pl-/);
  assert.match(buffetStripSectionClass('end'), /xl:items-end/);
  assert.match(buffetStripSectionClass('end'), /xl:pl-4/);
  assert.doesNotMatch(buffetStripSectionClass('end'), /xl:pr-/);
});

test('primary session actions share one layout class', () => {
  assert.match(waiterDetailLayout.primaryAction, /whitespace-nowrap/);
  assert.match(waiterDetailLayout.primaryAction, /sm:w-auto/);
  assert.match(waiterDetailLayout.cardBody, /px-4/);
  assert.equal(waiterDetailLayout.sectionBody.includes('px-4'), true);
});
