import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  staffRolePath,
  waiterBoardHref,
  waiterTableHref,
  waiterMenuHref,
  waiterBillHref,
  resolveWaiterMenuReturnHref,
  isDashboardWaiterReturnPath,
  checkoutRedirectAfterBillRequest,
} from './staff-routes';

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

describe('waiterMenuHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('builds slug menu link with waiter return path', () => {
    const href = waiterMenuHref('cafe-lisboa', tableId);
    assert.equal(
      href,
      `/cafe-lisboa/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(`/cafe-lisboa/waiter/${tableId}`)}`,
    );
  });

  it('builds dashboard menu link when embedded', () => {
    const href = waiterMenuHref('cafe-lisboa', tableId, { embeddedInDashboard: true });
    assert.ok(href.startsWith('/cafe-lisboa/menu?'));
    assert.ok(href.includes('return=%2Fdashboard%2Fwaiter%2F'));
  });
});

describe('waiterBillHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('builds slug bill link with waiter return path', () => {
    const href = waiterBillHref('cafe-lisboa', tableId);
    assert.equal(
      href,
      `/cafe-lisboa/bill?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(`/cafe-lisboa/waiter/${tableId}`)}`,
    );
  });

  it('builds dashboard bill link when embedded', () => {
    const href = waiterBillHref('cafe-lisboa', tableId, { embeddedInDashboard: true });
    assert.ok(href.startsWith('/cafe-lisboa/bill?'));
    assert.ok(href.includes('return=%2Fdashboard%2Fwaiter%2F'));
  });
});

describe('staffRolePath', () => {
  it('routes waiter staff to slug waiter board', () => {
    assert.equal(staffRolePath('cafe-lisboa', 'waiter'), '/cafe-lisboa/waiter');
  });

  it('routes frontdesk staff to dashboard overview', () => {
    assert.equal(staffRolePath('cafe-lisboa', 'frontdesk'), '/dashboard');
  });
});

describe('isDashboardWaiterReturnPath', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('matches dashboard waiter board and table paths', () => {
    assert.equal(isDashboardWaiterReturnPath('/dashboard/waiter'), true);
    assert.equal(
      isDashboardWaiterReturnPath(waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true })),
      true,
    );
  });

  it('rejects slug waiter and demo paths', () => {
    assert.equal(isDashboardWaiterReturnPath(waiterTableHref('cafe-lisboa', tableId)), false);
    assert.equal(isDashboardWaiterReturnPath('/demo/waiter'), false);
    assert.equal(isDashboardWaiterReturnPath(null), false);
  });
});

describe('checkoutRedirectAfterBillRequest', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('redirects frontdesk bill flow to dashboard checkout', () => {
    assert.equal(
      checkoutRedirectAfterBillRequest(
        tableId,
        waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true }),
      ),
      `/dashboard/checkout?table_id=${encodeURIComponent(tableId)}`,
    );
  });

  it('returns null for customer and slug waiter bill flows', () => {
    assert.equal(checkoutRedirectAfterBillRequest(tableId, null), null);
    assert.equal(
      checkoutRedirectAfterBillRequest(tableId, waiterTableHref('cafe-lisboa', tableId)),
      null,
    );
  });
});

describe('resolveWaiterMenuReturnHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('returns null when not from waiter', () => {
    assert.equal(resolveWaiterMenuReturnHref(undefined, '/dashboard/waiter', 'cafe-lisboa'), null);
  });

  it('accepts dashboard waiter table return path', () => {
    const path = waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true });
    assert.equal(resolveWaiterMenuReturnHref('waiter', path, 'cafe-lisboa'), path);
  });

  it('accepts slug waiter table return path', () => {
    const path = waiterTableHref('cafe-lisboa', tableId);
    assert.equal(resolveWaiterMenuReturnHref('waiter', path, 'cafe-lisboa'), path);
  });

  it('falls back to slug board when return path is unknown', () => {
    assert.equal(
      resolveWaiterMenuReturnHref('waiter', 'https://evil.example/phish', 'cafe-lisboa'),
      '/cafe-lisboa/waiter',
    );
  });

  it('falls back to demo board for demo flow', () => {
    assert.equal(
      resolveWaiterMenuReturnHref('waiter', '/evil', 'cafe-lisboa', { isDemo: true }),
      '/demo/waiter',
    );
  });
});
