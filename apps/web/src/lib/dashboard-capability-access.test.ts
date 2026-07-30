import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { capabilitiesFromKeys } from '@/lib/permissions/can';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { resolveCapabilitiesForOwner } from '@/lib/permissions/resolve';
import { resolveDashboardCapabilityAccess } from './dashboard-capability-access';

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

describe('resolveDashboardCapabilityAccess', () => {
  it('allows store_owner with value analytics capability', () => {
    const decision = resolveDashboardCapabilityAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys([NAV_PERMISSION.valueAnalytics]),
      NAV_PERMISSION.valueAnalytics,
    );
    assert.equal(decision.ok, true);
    if (decision.ok) assert.equal(decision.restaurantId, restaurant.id);
  });

  it('allows restaurant owner with backend-admin capabilities for abnormal ops', () => {
    const decision = resolveDashboardCapabilityAccess(
      { mode: 'owner', restaurant: restaurant as never },
      resolveCapabilitiesForOwner(),
      NAV_PERMISSION.abnormalOps,
    );
    assert.equal(decision.ok, true);
  });

  it('allows frontdesk with guest notice capability', () => {
    const decision = resolveDashboardCapabilityAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys([NAV_PERMISSION.guestNotice]),
      NAV_PERMISSION.guestNotice,
    );
    assert.equal(decision.ok, true);
  });

  it('rejects store_owner without guest notice capability', () => {
    const decision = resolveDashboardCapabilityAccess(
      { mode: 'staff', restaurant },
      capabilitiesFromKeys([NAV_PERMISSION.valueAnalytics]),
      NAV_PERMISSION.guestNotice,
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 403);
  });

  it('rejects unauthenticated', () => {
    const decision = resolveDashboardCapabilityAccess(
      { mode: 'unauthenticated' },
      null,
      NAV_PERMISSION.valueAnalytics,
    );
    assert.equal(decision.ok, false);
    if (!decision.ok) assert.equal(decision.status, 401);
  });
});
