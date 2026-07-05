import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  staffRolePath,
  waiterBoardHref,
  waiterTableHref,
  waiterMenuHref,
  waiterBillHref,
  resolveWaiterMenuReturnHref,
  resolveStaffAssistedFlow,
  isWaiterTableDetailReturnPath,
  isDashboardWaiterReturnPath,
  isSlugWaiterAssistedFlow,
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

  it('routes frontdesk staff to dashboard waiter board', () => {
    assert.equal(staffRolePath('cafe-lisboa', 'frontdesk'), '/dashboard/waiter');
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

describe('isSlugWaiterAssistedFlow', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('matches slug waiter table return paths', () => {
    assert.equal(
      isSlugWaiterAssistedFlow(waiterTableHref('cafe-lisboa', tableId)),
      true,
    );
  });

  it('rejects dashboard waiter and customer flows', () => {
    assert.equal(
      isSlugWaiterAssistedFlow(waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true })),
      false,
    );
    assert.equal(isSlugWaiterAssistedFlow(null), false);
    assert.equal(isSlugWaiterAssistedFlow('/dashboard/waiter'), false);
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

describe('isWaiterTableDetailReturnPath', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('matches waiter table detail paths', () => {
    assert.equal(isWaiterTableDetailReturnPath(waiterTableHref('cafe-lisboa', tableId)), true);
    assert.equal(
      isWaiterTableDetailReturnPath(waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true })),
      true,
    );
  });

  it('rejects waiter board list paths', () => {
    assert.equal(isWaiterTableDetailReturnPath('/dashboard/waiter'), false);
    assert.equal(isWaiterTableDetailReturnPath('/cafe-lisboa/waiter'), false);
    assert.equal(isWaiterTableDetailReturnPath(null), false);
  });
});

describe('resolveStaffAssistedFlow', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('returns null for customer menu entry', () => {
    assert.equal(resolveStaffAssistedFlow(undefined, undefined, 'cafe-lisboa', tableId), null);
  });

  it('resolves slug waiter assisted flow', () => {
    const returnPath = waiterTableHref('cafe-lisboa', tableId);
    const flow = resolveStaffAssistedFlow('waiter', returnPath, 'cafe-lisboa', tableId);
    assert.ok(flow);
    assert.equal(flow!.returnHref, returnPath);
    assert.equal(flow!.variant, 'slug_waiter');
    assert.equal(flow!.showBillCta, false);
    assert.equal(flow!.skipFeedback, true);
    assert.equal(flow!.checkoutRedirectHref, null);
  });

  it('resolves dashboard frontdesk assisted flow', () => {
    const returnPath = waiterTableHref('cafe-lisboa', tableId, { embeddedInDashboard: true });
    const flow = resolveStaffAssistedFlow('waiter', returnPath, 'cafe-lisboa', tableId);
    assert.ok(flow);
    assert.equal(flow!.variant, 'dashboard_frontdesk');
    assert.equal(flow!.showBillCta, true);
    assert.equal(
      flow!.checkoutRedirectHref,
      `/dashboard/checkout?table_id=${encodeURIComponent(tableId)}`,
    );
  });
});
