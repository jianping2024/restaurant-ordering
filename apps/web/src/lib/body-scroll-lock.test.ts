import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  bodyScrollLockCountForTest,
  lockBodyScroll,
  resetBodyScrollLock,
} from '@/lib/body-scroll-lock';

function installDocumentStub() {
  const bodyStyle = { overflow: '' };
  const htmlStyle = { overflow: '' };
  (globalThis as typeof globalThis & {
    document: {
      body: { style: typeof bodyStyle };
      documentElement: { style: typeof htmlStyle };
    };
  }).document = {
    body: { style: bodyStyle },
    documentElement: { style: htmlStyle },
  };
  return { bodyStyle, htmlStyle };
}

describe('body-scroll-lock', () => {
  beforeEach(() => {
    installDocumentStub();
    resetBodyScrollLock();
  });

  it('locks body and html on first acquire and restores on release', () => {
    const { bodyStyle, htmlStyle } = installDocumentStub();
    bodyStyle.overflow = 'scroll';
    htmlStyle.overflow = 'auto';
    const release = lockBodyScroll();
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(document.documentElement.style.overflow, 'hidden');
    assert.equal(bodyScrollLockCountForTest(), 1);
    release();
    assert.equal(document.body.style.overflow, 'scroll');
    assert.equal(document.documentElement.style.overflow, 'auto');
    assert.equal(bodyScrollLockCountForTest(), 0);
  });

  it('nested locks keep hidden until all released', () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    assert.equal(bodyScrollLockCountForTest(), 2);
    a();
    assert.equal(document.body.style.overflow, 'hidden');
    assert.equal(document.documentElement.style.overflow, 'hidden');
    b();
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.documentElement.style.overflow, '');
  });

  it('reset clears count and overflow on body and html', () => {
    lockBodyScroll();
    lockBodyScroll();
    resetBodyScrollLock();
    assert.equal(bodyScrollLockCountForTest(), 0);
    assert.equal(document.body.style.overflow, '');
    assert.equal(document.documentElement.style.overflow, '');
  });
});
