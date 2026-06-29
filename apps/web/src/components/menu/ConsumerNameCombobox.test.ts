import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterConsumerNameOptions,
  shouldShowConsumerNameMenu,
} from '@/lib/consumer-name-roster';

describe('ConsumerNameCombobox menu helpers', () => {
  it('returns no options for empty query', () => {
    assert.deepEqual(filterConsumerNameOptions(['lucy', 'john'], ''), []);
  });

  it('returns only partial substring matches', () => {
    assert.deepEqual(filterConsumerNameOptions(['lucy', 'john', 'jerry'], 'je'), ['jerry']);
    assert.deepEqual(filterConsumerNameOptions(['John'], 'J'), ['John']);
  });

  it('hides menu when query already matches a name exactly', () => {
    assert.deepEqual(filterConsumerNameOptions(['John'], 'John'), []);
  });

  it('returns empty when nothing matches', () => {
    assert.deepEqual(filterConsumerNameOptions(['lucy', 'john'], 'zzz'), []);
  });

  it('is false without query or matches', () => {
    assert.equal(shouldShowConsumerNameMenu(['lucy'], ''), false);
    assert.equal(shouldShowConsumerNameMenu(['lucy'], 'zzz'), false);
  });

  it('is true only when matches exist', () => {
    assert.equal(shouldShowConsumerNameMenu(['lucy', 'john'], 'lu'), true);
  });
});
