import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCustomerTableIdRequest } from './customer-session-context';

describe('resolveCustomerTableIdRequest', () => {
  const tableId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('returns by_id for a valid table_id param', () => {
    assert.deepEqual(resolveCustomerTableIdRequest(tableId), {
      kind: 'by_id',
      tableId,
    });
  });

  it('returns invalid for malformed table_id param', () => {
    assert.deepEqual(resolveCustomerTableIdRequest('not-a-uuid'), { kind: 'invalid' });
  });

  it('returns default when table_id is omitted', () => {
    assert.deepEqual(resolveCustomerTableIdRequest(undefined), { kind: 'default' });
    assert.deepEqual(resolveCustomerTableIdRequest(''), { kind: 'default' });
    assert.deepEqual(resolveCustomerTableIdRequest('   '), { kind: 'default' });
  });
});
