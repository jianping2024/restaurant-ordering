import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isValidTableGroupName, normalizeTableGroupName } from './restaurant-table-groups';

describe('table group name validation', () => {
  it('accepts valid names', () => {
    assert.equal(isValidTableGroupName('Salão'), true);
    assert.equal(normalizeTableGroupName('  Hall  '), 'Hall');
  });

  it('rejects reserved names', () => {
    assert.equal(isValidTableGroupName('ungrouped'), false);
  });
});
