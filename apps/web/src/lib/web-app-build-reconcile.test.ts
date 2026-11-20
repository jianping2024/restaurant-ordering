import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WEB_APP_BUILD_RELOAD_ATTEMPT_KEY,
  parseLiveHealthVersion,
  takeWebAppBuildReloadDecision,
  webAppBuildMismatch,
} from './web-app-build-reconcile.ts';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    key() {
      return null;
    },
  } as Storage;
}

describe('webAppBuildMismatch', () => {
  it('false when either side empty', () => {
    assert.equal(webAppBuildMismatch('', 'abc'), false);
    assert.equal(webAppBuildMismatch('abc', ''), false);
    assert.equal(webAppBuildMismatch(undefined, 'abc'), false);
  });

  it('true only when both non-empty and unequal', () => {
    assert.equal(webAppBuildMismatch('a', 'a'), false);
    assert.equal(webAppBuildMismatch(' a ', 'a'), false);
    assert.equal(webAppBuildMismatch('old', 'new'), true);
  });
});

describe('parseLiveHealthVersion', () => {
  it('reads trimmed version string', () => {
    assert.equal(parseLiveHealthVersion({ ok: true, status: 'live', version: '  v1  ' }), 'v1');
    assert.equal(parseLiveHealthVersion({ version: '' }), null);
    assert.equal(parseLiveHealthVersion(null), null);
  });
});

describe('takeWebAppBuildReloadDecision', () => {
  it('reloads once then blocks the same page→live pair', () => {
    const storage = memoryStorage();
    const first = takeWebAppBuildReloadDecision('old', 'new', storage);
    assert.deepEqual(first, { reload: true, pageVersion: 'old', liveVersion: 'new' });
    assert.equal(storage.getItem(WEB_APP_BUILD_RELOAD_ATTEMPT_KEY), 'old→new');
    const second = takeWebAppBuildReloadDecision('old', 'new', storage);
    assert.deepEqual(second, { reload: false });
  });

  it('clears attempt when versions match', () => {
    const storage = memoryStorage({ [WEB_APP_BUILD_RELOAD_ATTEMPT_KEY]: 'old→new' });
    assert.deepEqual(takeWebAppBuildReloadDecision('new', 'new', storage), { reload: false });
    assert.equal(storage.getItem(WEB_APP_BUILD_RELOAD_ATTEMPT_KEY), null);
  });
});
