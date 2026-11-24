import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dashboardStoreHref,
  parseDashboardStorePath,
  parseStoreScopedPath,
  restaurantApiPath,
} from './dashboard-store-routes';

describe('dashboard-store-routes', () => {
  it('builds store page and API hrefs', () => {
    assert.equal(dashboardStoreHref('cafe'), '/dashboard/r/cafe');
    assert.equal(dashboardStoreHref('cafe', '/menu?tab=items'), '/dashboard/r/cafe/menu?tab=items');
    assert.equal(restaurantApiPath('cafe', '/menu/items'), '/api/restaurants/cafe/menu/items');
  });

  it('parses store pathname into slug + page', () => {
    assert.deepEqual(parseDashboardStorePath('/dashboard/r/cafe'), { slug: 'cafe', page: '' });
    assert.deepEqual(parseDashboardStorePath('/dashboard/r/cafe/settings/staff'), {
      slug: 'cafe',
      page: '/settings/staff',
    });
    assert.equal(parseDashboardStorePath('/dashboard/menu'), null);
    assert.equal(parseDashboardStorePath('/dashboard/r/'), null);
  });


  it('store-scoped pages: dashboard, staff workbench, kitchen (last-store cookie)', () => {
    assert.deepEqual(parseStoreScopedPath('/dashboard/r/cafe/orders'), {
      slug: 'cafe',
      dashboardPage: '/orders',
    });
    assert.deepEqual(parseStoreScopedPath('/cafe/kitchen'), { slug: 'cafe', dashboardPage: null });
    assert.deepEqual(parseStoreScopedPath('/cafe/kitchen/screen-1'), {
      slug: 'cafe',
      dashboardPage: null,
    });
    assert.deepEqual(parseStoreScopedPath('/cafe/staff/waiter'), { slug: 'cafe', dashboardPage: null });
    assert.equal(parseStoreScopedPath('/cafe/staff/login'), null);
    assert.equal(parseStoreScopedPath('/auth/staff/change-password'), null);
    assert.equal(parseStoreScopedPath('/dashboard/select-store'), null);
    assert.equal(parseStoreScopedPath('/cafe/menu'), null);
    assert.equal(parseStoreScopedPath('/api/restaurants/cafe/staff/x'), null);
  });
});
