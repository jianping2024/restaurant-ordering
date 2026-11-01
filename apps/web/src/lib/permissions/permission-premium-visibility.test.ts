import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ROLE_PERMISSION_PAGE_TREE } from '@/lib/permissions/permission-page-tree';
import {
  filterPermissionTreeByHiddenKeys,
  mergePreservedHiddenPermissions,
  permissionKeysHiddenWithoutPremium,
} from '@/lib/permissions/permission-premium-visibility';
import type { PermissionKey } from '@/lib/permissions/registry';

describe('permission-premium-visibility', () => {
  it('hides dashboard.menu.video.manage when menu_dish_video is not entitled', () => {
    const hidden = permissionKeysHiddenWithoutPremium(
      { plan: 'pro', pro_valid_until: null, license_valid_until: null },
      [],
    );
    assert.ok(hidden.includes('dashboard.menu.video.manage'));
  });

  it('does not hide video.manage when menu_dish_video is entitled on pro plan', () => {
    const hidden = permissionKeysHiddenWithoutPremium(
      { plan: 'pro', pro_valid_until: null, license_valid_until: null },
      ['menu_dish_video'],
    );
    assert.ok(!hidden.includes('dashboard.menu.video.manage'));
  });

  it('filters video.manage out of the page tree but keeps menu.view', () => {
    const filtered = filterPermissionTreeByHiddenKeys(
      ROLE_PERMISSION_PAGE_TREE,
      new Set<PermissionKey>(['dashboard.menu.video.manage']),
    );
    const menu = filtered.find((n) => n.permission === 'dashboard.menu.view');
    assert.ok(menu);
    assert.ok(
      !(menu.children ?? []).some((c) => c.permission === 'dashboard.menu.video.manage'),
    );
    assert.ok(
      (menu.children ?? []).some((c) => c.permission === 'dashboard.menu.print_stations.manage'),
    );
  });

  it('merge preserves hidden video.manage when menu.view stays', () => {
    const merged = mergePreservedHiddenPermissions(
      ['dashboard.menu.view', 'dashboard.menu.print_stations.manage'],
      ['dashboard.menu.view', 'dashboard.menu.video.manage'],
      new Set<PermissionKey>(['dashboard.menu.video.manage']),
    );
    assert.ok(merged.includes('dashboard.menu.video.manage'));
    assert.ok(merged.includes('dashboard.menu.view'));
  });

  it('merge drops hidden video.manage when menu.view was revoked', () => {
    const merged = mergePreservedHiddenPermissions(
      ['dashboard.orders.view'],
      ['dashboard.menu.view', 'dashboard.menu.video.manage'],
      new Set<PermissionKey>(['dashboard.menu.video.manage']),
    );
    assert.ok(!merged.includes('dashboard.menu.video.manage'));
    assert.ok(!merged.includes('dashboard.menu.view'));
  });
});
