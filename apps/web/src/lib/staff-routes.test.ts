import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  staffRolePath,
  waiterBoardHref,
  waiterTableHref,
  waiterMenuHref,
  waiterBillHref,
  slugWaiterTableHref,
  resolveWaiterMenuReturnHref,
  resolveStaffAssistedFlow,
  isWaiterTableDetailReturnPath,
  isDashboardWaiterReturnPath,
  checkoutRedirectAfterBillRequest,
  normalizeWaiterReturnPath,
} from './staff-routes';

describe('waiterBoardHref', () => {
  it('returns dashboard path for production', () => {
    assert.equal(waiterBoardHref('cafe-lisboa'), '/dashboard/waiter');
    assert.equal(waiterBoardHref('cafe-lisboa', { embeddedInDashboard: true }), '/dashboard/waiter');
  });

  it('returns demo path', () => {
    assert.equal(waiterBoardHref('cafe-lisboa', { isDemo: true }), '/demo/waiter');
  });
});

describe('waiterTableHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('returns dashboard table path for production', () => {
    assert.equal(
      waiterTableHref('cafe-lisboa', tableId),
      `/dashboard/waiter/${encodeURIComponent(tableId)}`,
    );
  });
});

describe('waiterMenuHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('builds menu link with dashboard return path', () => {
    const href = waiterMenuHref('cafe-lisboa', tableId);
    assert.equal(
      href,
      `/cafe-lisboa/menu?table_id=${encodeURIComponent(tableId)}&from=waiter&return=${encodeURIComponent(`/dashboard/waiter/${tableId}`)}`,
    );
  });
});

describe('waiterBillHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('builds bill link with dashboard return path', () => {
    const href = waiterBillHref('cafe-lisboa', tableId);
    assert.ok(href.startsWith('/cafe-lisboa/bill?'));
    assert.ok(href.includes('return=%2Fdashboard%2Fwaiter%2F'));
  });
});

describe('staffRolePath', () => {
  it('routes kitchen to kitchen and floor/desk roles to dashboard waiter board', () => {
    assert.equal(staffRolePath('cafe-lisboa', 'kitchen'), '/cafe-lisboa/kitchen');
    assert.equal(staffRolePath('cafe-lisboa', 'waiter'), '/dashboard/waiter');
    assert.equal(staffRolePath('cafe-lisboa', 'cashier'), '/dashboard/waiter');
    assert.equal(staffRolePath('cafe-lisboa', 'frontdesk'), '/dashboard/waiter');
  });
});

describe('isDashboardWaiterReturnPath', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('matches dashboard waiter board and table paths', () => {
    assert.equal(isDashboardWaiterReturnPath('/dashboard/waiter'), true);
    assert.equal(isDashboardWaiterReturnPath(waiterTableHref('cafe-lisboa', tableId)), true);
  });

  it('rejects slug waiter and demo paths', () => {
    assert.equal(isDashboardWaiterReturnPath(slugWaiterTableHref('cafe-lisboa', tableId)), false);
    assert.equal(isDashboardWaiterReturnPath('/demo/waiter'), false);
    assert.equal(isDashboardWaiterReturnPath(null), false);
  });
});

describe('checkoutRedirectAfterBillRequest', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('redirects when assist checkout is allowed', () => {
    assert.equal(
      checkoutRedirectAfterBillRequest(tableId, true),
      `/dashboard/checkout?table_id=${encodeURIComponent(tableId)}`,
    );
  });

  it('returns null when assist checkout is denied', () => {
    assert.equal(checkoutRedirectAfterBillRequest(tableId, false), null);
  });
});

describe('normalizeWaiterReturnPath', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('maps legacy slug returns onto dashboard', () => {
    assert.equal(normalizeWaiterReturnPath('/cafe-lisboa/waiter', 'cafe-lisboa'), '/dashboard/waiter');
    assert.equal(
      normalizeWaiterReturnPath(slugWaiterTableHref('cafe-lisboa', tableId), 'cafe-lisboa'),
      waiterTableHref('cafe-lisboa', tableId),
    );
  });
});

describe('resolveWaiterMenuReturnHref', () => {
  const tableId = '550e8400-e29b-41d4-a716-446655440001';

  it('returns null when not from waiter', () => {
    assert.equal(resolveWaiterMenuReturnHref(undefined, '/dashboard/waiter', 'cafe-lisboa'), null);
  });

  it('accepts dashboard waiter table return path', () => {
    const path = waiterTableHref('cafe-lisboa', tableId);
    assert.equal(resolveWaiterMenuReturnHref('waiter', path, 'cafe-lisboa'), path);
  });

  it('normalizes legacy slug waiter table return path', () => {
    const path = slugWaiterTableHref('cafe-lisboa', tableId);
    assert.equal(
      resolveWaiterMenuReturnHref('waiter', path, 'cafe-lisboa'),
      waiterTableHref('cafe-lisboa', tableId),
    );
  });

  it('falls back to dashboard board when return path is unknown', () => {
    assert.equal(
      resolveWaiterMenuReturnHref('waiter', 'https://evil.example/phish', 'cafe-lisboa'),
      '/dashboard/waiter',
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
    assert.equal(isWaiterTableDetailReturnPath(slugWaiterTableHref('cafe-lisboa', tableId)), true);
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

  it('resolves waiter assist without bill checkout', () => {
    const returnPath = waiterTableHref('cafe-lisboa', tableId);
    const flow = resolveStaffAssistedFlow('waiter', returnPath, 'cafe-lisboa', tableId, {
      canAssistBillCheckout: false,
    });
    assert.ok(flow);
    assert.equal(flow!.returnHref, returnPath);
    assert.equal(flow!.variant, 'staff');
    assert.equal(flow!.showBillCta, false);
    assert.equal(flow!.checkoutRedirectHref, null);
  });

  it('resolves desk assist with bill checkout', () => {
    const returnPath = waiterTableHref('cafe-lisboa', tableId);
    const flow = resolveStaffAssistedFlow('waiter', returnPath, 'cafe-lisboa', tableId, {
      canAssistBillCheckout: true,
    });
    assert.ok(flow);
    assert.equal(flow!.variant, 'staff');
    assert.equal(flow!.showBillCta, true);
    assert.equal(
      flow!.checkoutRedirectHref,
      `/dashboard/checkout?table_id=${encodeURIComponent(tableId)}`,
    );
  });
});
