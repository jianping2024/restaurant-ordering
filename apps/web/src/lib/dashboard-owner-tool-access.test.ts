import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { resolveCapabilitiesForOwner } from '@/lib/permissions/resolve';
import {
  OWNER_TOOL_PERMISSIONS,
  resolveOwnerToolCapabilityAccess,
} from './dashboard-owner-tool-access';

const restaurant = {
  id: '88064a0b-1d36-4633-aa21-c928039e4f57',
  name: '白云',
  slug: 'restaurant-mohnrib5',
  logo_url: null,
  feature_flags: {},
  buffet_service_mode: 'classic' as const,
  suspended_at: null,
  suspension_reason: null,
};

describe('resolveOwnerToolCapabilityAccess', () => {
  it('allows store_owner with value analytics capability', () => {
    const decision = resolveOwnerToolCapabilityAccess(
      { mode: 'store_owner', restaurant },
      capabilitiesFromKeys([OWNER_TOOL_PERMISSIONS.valueAnalytics]),
      OWNER_TOOL_PERMISSIONS.valueAnalytics,
    );
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.restaurantId, restaurant.id);
  });

  it('allows restaurant owner with backend-admin capabilities', () => {
    const decision = resolveOwnerToolCapabilityAccess(
      { mode: 'owner', restaurant: restaurant as never },
      resolveCapabilitiesForOwner(),
      OWNER_TOOL_PERMISSIONS.abnormalOps,
    );
    assert.equal(decision.ok, true);
  });

  it('rejects frontdesk without the capability', () => {
    const decision = resolveOwnerToolCapabilityAccess(
      { mode: 'frontdesk', restaurant },
      capabilitiesFromKeys(['dashboard.overview.view']),
      OWNER_TOOL_PERMISSIONS.abnormalOps,
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 403);
  });

  it('rejects unauthenticated', () => {
    const decision = resolveOwnerToolCapabilityAccess(
      { mode: 'unauthenticated' },
      null,
      OWNER_TOOL_PERMISSIONS.valueAnalytics,
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 401);
  });
});
