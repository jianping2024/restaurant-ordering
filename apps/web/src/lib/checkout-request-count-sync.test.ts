import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT,
  invalidateCheckoutRequestCount,
} from './checkout-request-count-sync';

describe('invalidateCheckoutRequestCount', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const listeners = new Map<string, Set<EventListener>>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        addEventListener: (type: string, listener: EventListener) => {
          const set = listeners.get(type) ?? new Set();
          set.add(listener);
          listeners.set(type, set);
        },
        removeEventListener: (type: string, listener: EventListener) => {
          listeners.get(type)?.delete(listener);
        },
        dispatchEvent: (event: Event) => {
          for (const listener of listeners.get(event.type) ?? []) {
            listener(event);
          }
          return true;
        },
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('dispatches the checkout count invalidate event', () => {
    let fired = 0;
    const handler = () => {
      fired += 1;
    };
    window.addEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, handler);
    try {
      invalidateCheckoutRequestCount();
      assert.equal(fired, 1);
    } finally {
      window.removeEventListener(CHECKOUT_REQUEST_COUNT_INVALIDATE_EVENT, handler);
    }
  });
});
