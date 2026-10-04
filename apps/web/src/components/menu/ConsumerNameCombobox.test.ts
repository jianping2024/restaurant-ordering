import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { filterConsumerNameOptions } from '@/lib/consumer-name-roster';

describe('ConsumerNameCombobox suggestion helpers', () => {
  it('lists every option for empty query', () => {
    assert.deepEqual(filterConsumerNameOptions(['lucy', 'john'], ''), ['lucy', 'john']);
    assert.deepEqual(filterConsumerNameOptions(['lucy'], '  '), ['lucy']);
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
});
