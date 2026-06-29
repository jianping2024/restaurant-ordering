import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_NAV_COLLAPSED_STORAGE_KEY,
  DASHBOARD_NAV_WIDTH_COLLAPSED,
  DASHBOARD_NAV_WIDTH_EXPANDED,
  dashboardMainOffsetClass,
  dashboardNavWidthClass,
  dashboardNavWidthRem,
  dashboardShellGridClass,
} from './dashboard-nav-layout.ts';

describe('dashboard-nav-layout', () => {
  it('uses stable storage key', () => {
    assert.equal(DASHBOARD_NAV_COLLAPSED_STORAGE_KEY, 'mesa:dashboard-nav-collapsed');
  });

  it('maps expanded/collapsed width rem values', () => {
    assert.equal(dashboardNavWidthRem(false), DASHBOARD_NAV_WIDTH_EXPANDED);
    assert.equal(dashboardNavWidthRem(true), DASHBOARD_NAV_WIDTH_COLLAPSED);
  });

  it('maps expanded/collapsed width classes', () => {
    assert.equal(dashboardNavWidthClass(false), 'lg:w-64');
    assert.equal(dashboardNavWidthClass(true), 'lg:w-[4.5rem]');
  });

  it('maps expanded/collapsed main offset classes', () => {
    assert.equal(dashboardMainOffsetClass(false), 'lg:ml-64');
    assert.equal(dashboardMainOffsetClass(true), 'lg:ml-[4.5rem]');
  });

  it('maps expanded/collapsed grid shell classes', () => {
    assert.equal(
      dashboardShellGridClass(false),
      'lg:[grid-template-columns:16rem_minmax(0,1fr)]',
    );
    assert.equal(
      dashboardShellGridClass(true),
      'lg:[grid-template-columns:4.5rem_minmax(0,1fr)]',
    );
  });
});
