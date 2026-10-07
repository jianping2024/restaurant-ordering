import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retiredStaffAuthEmail } from './staff-user-ban';

describe('retiredStaffAuthEmail', () => {
  it('mints a stable freed mailbox from the auth user id', () => {
    const id = '01234567-89ab-cdef-0123-456789abcdef';
    assert.equal(
      retiredStaffAuthEmail(id),
      'deleted.0123456789abcdef0123456789abcdef@mesa.in',
    );
  });
});
