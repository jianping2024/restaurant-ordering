import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STAFF_SHELL_MAIN_CLASS } from './staff-shell-layout';

describe('staff-shell-layout', () => {
  it('main region stays a non-scrollport so sticky chrome can pin under the top bar', () => {
    assert.match(STAFF_SHELL_MAIN_CLASS, /min-h-0/);
    assert.match(STAFF_SHELL_MAIN_CLASS, /flex-1/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /overflow-/);
  });
});
