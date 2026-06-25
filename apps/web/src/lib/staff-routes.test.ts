import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { staffRolePath, waiterBoardHref, waiterTableHref } from './staff-routes';

describe('waiterBoardHref', () => {
  it('returns staff slug path by default', () => {
    assert.equal(waiterBoardHref('cafe-lisboa'), '/cafe-lisboa/waiter');
  });

  it('returns dashboard path when embedded', () => {
    assert.equal(waiterBoardHref('cafe-lisboa', { embeddedInDashboard: true }), '/dashboard/waiter');
  });

  it('returns demo path', () => {
    assert.equal(waiterBoardHref('cafe-lisboa', { isDemo: true }), '/demo/waiter');
  });
});

describe('waiterTableHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('returns staff slug table path by default', () => {
    assert.equal(
      waiterTableHref('cafe-lisboa', tableId),
      `/cafe-lisboa/waiter/${encodeURIComponent(tableId)}`,
    );
  });

  it('returns dashboard table path when embedded', () => {
    assert.equal(
      waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true }),
      `/dashboard/waiter/${encodeURIComponent(tableId)}`,
    );
  });
});

describe('staffRolePath', () => {
  it('routes waiter staff to slug waiter board', () => {
    assert.equal(staffRolePath('cafe-lisboa', 'waiter'), '/cafe-lisboa/waiter');
  });
});
