import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STAFF_SHELL_CONTENT_CLASS, STAFF_SHELL_MAIN_CLASS } from './staff-shell-layout';

describe('staff-shell-layout', () => {
  it('main region stays a non-scrollport so sticky chrome can pin under the top bar', () => {
    assert.match(STAFF_SHELL_MAIN_CLASS, /min-h-0/);
    assert.match(STAFF_SHELL_MAIN_CLASS, /min-w-0/);
    assert.match(STAFF_SHELL_MAIN_CLASS, /flex-1/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /overflow-/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /max-w-full/);
  });

  it('sole staff content column is max-w-[120rem] centered with shared X-pad (floor dense / topbar)', () => {
    assert.match(STAFF_SHELL_CONTENT_CLASS, /max-w-\[120rem\]/);
    assert.match(STAFF_SHELL_CONTENT_CLASS, /mx-auto/);
    assert.match(STAFF_SHELL_CONTENT_CLASS, /safe-area-inset-left/);
    assert.match(STAFF_SHELL_CONTENT_CLASS, /safe-area-inset-right/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /max-w-\[120rem\]/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /max-w-6xl/);
    assert.doesNotMatch(STAFF_SHELL_MAIN_CLASS, /\bpx-/);
    assert.match(STAFF_SHELL_MAIN_CLASS, /\bpy-4\b/);
  });
});
