import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS,
  shouldReconcileStaffSurfaceOnAttention,
} from './use-restaurant-staff-entry-reconcile.ts';

describe('shouldReconcileStaffSurfaceOnAttention', () => {
  it('is true only when document is visible', () => {
    const original = globalThis.document;
    const fake = { visibilityState: 'visible' as DocumentVisibilityState };
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fake,
    });
    try {
      assert.equal(shouldReconcileStaffSurfaceOnAttention(), true);
      fake.visibilityState = 'hidden';
      assert.equal(shouldReconcileStaffSurfaceOnAttention(), false);
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: original,
      });
    }
  });
});

describe('STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS', () => {
  it('stays a short coalesce window (not interval polling)', () => {
    assert.ok(STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS > 0);
    assert.ok(STAFF_ENTRY_FOCUS_RECONCILE_DEBOUNCE_MS < 2000);
  });
});
