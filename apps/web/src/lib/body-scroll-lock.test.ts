import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  bodyScrollLockCountForTest,
  lockBodyScroll,
  resetBodyScrollLock,
} from '@/lib/body-scroll-lock';

function installDocumentBodyStub() {
  const style = { overflow: '' };
  (globalThis as typeof globalThis & { document: { body: { style: typeof style } } }).document = {
    body: { style },
  };
  return style;
}

describe('body-scroll-lock', () => {
  beforeEach(() => {
    installDocumentBodyStub();
    resetBodyScrollLock();
  });

  it('locks on first acquire and restores on release', () => {
    const style = installDocumentBodyStub();
    style.overflow = 'scroll';
    const release = lockBodyScroll();
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(bodyScrollLockCountForTest(), 1);
    release();
    assert.equal(document.body.style.overflow, 'scroll');
    assert.equal(bodyScrollLockCountForTest(), 0);
  });

  it('nested locks keep hidden until all released', () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    assert.equal(bodyScrollLockCountForTest(), 2);
    a();
    assert.equal(document.body.style.overflow, 'hidden');
    b();
    assert.equal(document.body.style.overflow, '');
  });

  it('reset clears count and overflow', () => {
    lockBodyScroll();
    lockBodyScroll();
    resetBodyScrollLock();
    assert.equal(bodyScrollLockCountForTest(), 0);
    assert.equal(document.body.style.overflow, '');
  });
});
