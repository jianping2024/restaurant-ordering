import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { defaultDashboardNavOpen } from './dashboard-nav-config';
import {
  dashboardNavOpenStorageKey,
  loadDashboardNavOpen,
  resolveDashboardNavOpen,
  saveDashboardNavOpen,
} from './dashboard-nav-preference';

describe('dashboardNavOpenStorageKey', () => {
  it('scopes preference by role and restaurant', () => {
    assert.equal(
      dashboardNavOpenStorageKey('r1', 'frontdesk'),
      'mesa-dashboard-nav-open:frontdesk:r1',
    );
  });
});

describe('defaultDashboardNavOpen', () => {
  it('opens for owner and closes for operational roles', () => {
    assert.equal(defaultDashboardNavOpen('owner'), true);
    assert.equal(defaultDashboardNavOpen('frontdesk'), false);
    assert.equal(defaultDashboardNavOpen('cashier'), false);
  });
});

describe('dashboard nav open preference', () => {
  const key = dashboardNavOpenStorageKey('test-restaurant', 'frontdesk');
  const storage = new Map<string, string>();

  const originalWindow = globalThis.window;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('round-trips nav open state', () => {
    assert.equal(loadDashboardNavOpen('test-restaurant', 'frontdesk'), null);
    saveDashboardNavOpen('test-restaurant', 'frontdesk', true);
    assert.equal(loadDashboardNavOpen('test-restaurant', 'frontdesk'), true);
    assert.equal(storage.get(key), '1');
    saveDashboardNavOpen('test-restaurant', 'frontdesk', false);
    assert.equal(loadDashboardNavOpen('test-restaurant', 'frontdesk'), false);
    assert.equal(storage.get(key), '0');
  });

  it('falls back to role default when unset', () => {
    assert.equal(resolveDashboardNavOpen('test-restaurant', 'owner'), true);
    assert.equal(resolveDashboardNavOpen('test-restaurant', 'frontdesk'), false);
    saveDashboardNavOpen('test-restaurant', 'owner', false);
    assert.equal(resolveDashboardNavOpen('test-restaurant', 'owner'), false);
  });
});
