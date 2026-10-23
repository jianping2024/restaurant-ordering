import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseCommaSeparatedTableIds } from '@/lib/restaurant-tables';

describe('parseCommaSeparatedTableIds', () => {
  it('returns empty for blank', () => {
    assert.deepEqual(parseCommaSeparatedTableIds(null), []);
    assert.deepEqual(parseCommaSeparatedTableIds(''), []);
    assert.deepEqual(parseCommaSeparatedTableIds('  '), []);
  });

  it('parses unique valid uuids and drops junk', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    assert.deepEqual(
      parseCommaSeparatedTableIds(`${a}, not-a-uuid, ${a.toUpperCase()}, ${b}`),
      [a, b],
    );
  });
});
