import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  bodyScrollLockCountForTest,
  lockBodyScroll,
  MENU_SCROLLPORT_SELECTOR,
  resetBodyScrollLock,
  savedMenuScrollportCountForTest,
} from '@/lib/body-scroll-lock';

type StyleBag = { overflow: string };

function makeScrollEl(scrollTop: number, attrs: Record<string, string> = {}): HTMLElement {
  const style: StyleBag = { overflow: '' };
  const el = {
    scrollTop,
    style,
    isConnected: true,
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    hasAttribute(name: string) {
      return name in attrs;
    },
  };
  return el as unknown as HTMLElement;
}

function installDocumentStub(scrollEls: HTMLElement[] = []) {
  const bodyStyle: StyleBag = { overflow: '' };
  const htmlStyle: StyleBag = { overflow: '' };
  (globalThis as typeof globalThis & {
    document: {
      body: { style: StyleBag };
      documentElement: { style: StyleBag };
      querySelectorAll: (selector: string) => HTMLElement[];
    };
  }).document = {
    body: { style: bodyStyle },
    documentElement: { style: htmlStyle },
    querySelectorAll(selector: string) {
      if (selector !== MENU_SCROLLPORT_SELECTOR) return [];
      return scrollEls;
    },
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

  it('freezes menu scrollports and restores scrollTop on unlock', () => {
    const storefront = makeScrollEl(420, { 'data-mesa-storefront-menu-scroll': '' });
    installDocumentStub([storefront]);
    const release = lockBodyScroll();
    assert.equal(savedMenuScrollportCountForTest(), 1);
    assert.equal(storefront.style.overflow, 'hidden');
    assert.equal(storefront.scrollTop, 420);
    storefront.scrollTop = 0;
    release();
    assert.equal(storefront.style.overflow, '');
    assert.equal(storefront.scrollTop, 420);
    assert.equal(savedMenuScrollportCountForTest(), 0);
  });

  it('nested locks freeze scrollports once and restore after last release', () => {
    const catalog = makeScrollEl(88, { 'data-mesa-menu-catalog-pane': '' });
    installDocumentStub([catalog]);
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    assert.equal(savedMenuScrollportCountForTest(), 1);
    assert.equal(catalog.style.overflow, 'hidden');
    catalog.scrollTop = 12;
    a();
    assert.equal(catalog.scrollTop, 12);
    assert.equal(catalog.style.overflow, 'hidden');
    b();
    assert.equal(catalog.scrollTop, 88);
    assert.equal(catalog.style.overflow, '');
    assert.equal(savedMenuScrollportCountForTest(), 0);
  });

  it('reset restores menu scrollport overflow and scrollTop', () => {
    const storefront = makeScrollEl(200, { 'data-mesa-storefront-menu-scroll': '' });
    installDocumentStub([storefront]);
    lockBodyScroll();
    storefront.scrollTop = 1;
    resetBodyScrollLock();
    assert.equal(storefront.scrollTop, 200);
    assert.equal(storefront.style.overflow, '');
    assert.equal(savedMenuScrollportCountForTest(), 0);
  });
});
