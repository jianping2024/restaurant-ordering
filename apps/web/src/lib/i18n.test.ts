import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getClientLanguage, normalizePrintLocale, printLocaleOption, setClientLanguage, UI_LANG_COOKIE } from './i18n';

const LEGACY_KEY = 'mesa-lang';

function mockBrowserStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
  };
  Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(globalThis, 'document', {
    value: { cookie: '' },
    configurable: true,
  });
  return data;
}

describe('getClientLanguage', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window');
    Reflect.deleteProperty(globalThis, 'localStorage');
    Reflect.deleteProperty(globalThis, 'document');
  });

  it('reads canonical storage key', () => {
    const data = mockBrowserStorage();
    data.set(UI_LANG_COOKIE, 'en');
    assert.equal(getClientLanguage(), 'en');
  });

  it('migrates legacy mesa-lang to mesa-ui-lang and removes legacy key', () => {
    const data = mockBrowserStorage();
    data.set(LEGACY_KEY, 'pt');
    assert.equal(getClientLanguage(), 'pt');
    assert.equal(data.get(UI_LANG_COOKIE), 'pt');
    assert.equal(data.has(LEGACY_KEY), false);
  });

  it('prefers cookie over localStorage', () => {
    const data = mockBrowserStorage();
    data.set(UI_LANG_COOKIE, 'zh');
    document.cookie = `${UI_LANG_COOKIE}=en; path=/`;
    assert.equal(getClientLanguage(), 'en');
  });

  it('prefers canonical key over legacy', () => {
    const data = mockBrowserStorage();
    data.set(UI_LANG_COOKIE, 'en');
    data.set(LEGACY_KEY, 'zh');
    assert.equal(getClientLanguage(), 'en');
    assert.equal(data.get(LEGACY_KEY), 'zh');
  });

  it('setClientLanguage removes legacy key', () => {
    const data = mockBrowserStorage();
    data.set(LEGACY_KEY, 'zh');
    setClientLanguage('en');
    assert.equal(data.get(UI_LANG_COOKIE), 'en');
    assert.equal(data.has(LEGACY_KEY), false);
  });
});

describe('print locale', () => {
  it('defaults to Portuguese and reuses UI language option labels', () => {
    assert.equal(normalizePrintLocale(null), 'pt');
    assert.equal(normalizePrintLocale('de'), 'pt');
    assert.equal(normalizePrintLocale('zh'), 'zh');
    assert.equal(printLocaleOption('pt').id, 'pt');
    assert.equal(printLocaleOption('en').id, 'en');
    assert.equal(printLocaleOption('zh').id, 'zh');
  });
});
