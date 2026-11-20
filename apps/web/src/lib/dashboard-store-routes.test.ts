import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  dashboardStoreHref,
  parseDashboardStorePath,
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

});
