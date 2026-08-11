import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ROLE_PERMISSION_PAGE_TREE,
  assertPermissionPageTreeCoversRegistry,
  flattenPermissionTreeKeys,
  resolvePermissionTreeLabel,
  rolePermissionPageTreeForHost,
} from '@/lib/permissions/permission-page-tree';
import { ALL_PERMISSION_KEYS, NAV_PERMISSION } from '@/lib/permissions/registry';
import { settingsPermissionChildren } from '@/lib/permissions/role-permission-set';
import { SETTINGS_NAV_TABS } from '@/lib/settings-nav';

describe('ROLE_PERMISSION_PAGE_TREE', () => {
  it('covers every registry key exactly once', () => {
    assert.doesNotThrow(() => assertPermissionPageTreeCoversRegistry());
    const flat = flattenPermissionTreeKeys();
    assert.equal(flat.length, ALL_PERMISSION_KEYS.length);
    assert.equal(new Set(flat).size, flat.length);
  });

  it('nests settings tabs (incl. 后厨大屏) once under 餐厅设置', () => {
    const settings = ROLE_PERMISSION_PAGE_TREE.find(
      (n) => n.permission === 'dashboard.settings.view',
    );
    assert.ok(settings?.children?.length);
    const childKeys = settings!.children!.map((c) => c.permission);
    assert.equal(childKeys.filter((k) => k === 'floor.kitchen_screens.manage').length, 1);
    assert.ok(!flattenPermissionTreeKeys().filter((k) => k === 'floor.kitchen_screens.manage').slice(1).length);

    const navPerms = SETTINGS_NAV_TABS.filter((t) => t.permission && !t.backendAdminOnPremOnly).map(
      (t) => t.permission!,
    );
    assert.deepEqual(new Set(childKeys), new Set(navPerms));
    assert.deepEqual(new Set(childKeys), new Set(settingsPermissionChildren()));
  });

  it('resolves settings tab label from product settings i18n (not a second name)', () => {
    const zh = resolvePermissionTreeLabel(
      { source: 'settingsTab', labelKey: 'tabKitchenScreens' },
      'zh',
    );
    assert.equal(zh, '后厨大屏');
    const settingsNav = resolvePermissionTreeLabel({ source: 'nav', key: 'settings' }, 'zh');
    assert.equal(settingsNav, '餐厅设置');
  });

  it('places open/save under 楼面看板 only', () => {
    const waiter = ROLE_PERMISSION_PAGE_TREE.find(
      (n) => n.permission === 'dashboard.waiter_board.view',
    );
    assert.ok(waiter?.children?.some((c) => c.permission === 'tables.open_session'));
    const openCount = flattenPermissionTreeKeys().filter((k) => k === 'tables.open_session').length;
    assert.equal(openCount, 1);
  });

  it('kitchen board is one tree row (top-nav + page share floor.kitchen_board.view)', () => {
    const kitchenRows = ROLE_PERMISSION_PAGE_TREE.filter(
      (n) => n.permission === 'floor.kitchen_board.view',
    );
    assert.equal(kitchenRows.length, 1);
    assert.ok(kitchenRows[0]?.children?.some((c) => c.permission === 'orders.kitchen_update'));
    assert.equal(
      flattenPermissionTreeKeys().filter((k) => k === 'dashboard.kitchen_shortcut.view').length,
      0,
    );
    const zh = resolvePermissionTreeLabel({ source: 'navExtra', key: 'viewKitchen' }, 'zh');
    assert.equal(zh, '厨房看板');
    const labels = ROLE_PERMISSION_PAGE_TREE.map((n) => resolvePermissionTreeLabel(n.label, 'zh'));
    assert.equal(labels.filter((l) => l === '厨房看板').length, 1);
  });
});

describe('rolePermissionPageTreeForHost', () => {
  it('drops operation logs permission off on-prem hosts', () => {
    const cloudTree = rolePermissionPageTreeForHost(false);
    assert.equal(
      cloudTree.some((n) => n.permission === NAV_PERMISSION.operationLogs),
      false,
    );
    assert.equal(rolePermissionPageTreeForHost(true), ROLE_PERMISSION_PAGE_TREE);
  });
});
