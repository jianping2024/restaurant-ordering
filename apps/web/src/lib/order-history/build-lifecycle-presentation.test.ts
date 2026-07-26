import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildOrderHistoryLifecycleLines,
  resolveOrderHistoryAbnormalEmphasis,
  resolveOrderHistoryCardClass,
  resolveOrderHistoryClosedByLabel,
} from '@/lib/order-history/build-lifecycle-presentation';
import { getMessages } from '@/lib/i18n/messages';

const i18n = getMessages('zh').orderHistory;

describe('resolveOrderHistoryAbnormalEmphasis', () => {
  it('marks forced unpaid as strong', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('unpaid_closed', {
        isForcedUnpaidClose: true,
        reasonCode: 'left_unpaid',
        reasonDetail: null,
      }),
      'strong',
    );
  });

  it('marks unpaid and partial as moderate without forced annotation', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('unpaid_closed', { isForcedUnpaidClose: false }),
      'moderate',
    );
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('partially_collected_closed', {
        isForcedUnpaidClose: false,
      }),
      'moderate',
    );
  });

  it('does not emphasize settled or without-billing', () => {
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('fully_paid', { isForcedUnpaidClose: false }),
      'none',
    );
    assert.equal(
      resolveOrderHistoryAbnormalEmphasis('closed_without_billing', {
        isForcedUnpaidClose: false,
      }),
      'none',
    );
  });
});

describe('resolveOrderHistoryClosedByLabel', () => {
  it('prefers operator name', () => {
    assert.equal(
      resolveOrderHistoryClosedByLabel('YAN ZI', 'auto_nightly', i18n),
      'YAN ZI',
    );
  });

  it('uses nightly and merge labels when operator missing', () => {
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'auto_nightly', i18n), '夜间自动');
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'merged', i18n), '并台');
    assert.equal(resolveOrderHistoryClosedByLabel(null, 'frontdesk_closed', i18n), '—');
  });
});

describe('buildOrderHistoryLifecycleLines', () => {
  it('builds labeled open and close lines', () => {
    const lines = buildOrderHistoryLifecycleLines(
      {
        openedAt: '2026-07-26T10:00:00.000Z',
        openedByName: 'Waiter',
        closedAt: '2026-07-26T14:00:00.000Z',
        closedByName: 'Cashier',
        closedReason: 'cashier_closed',
      },
      i18n,
      (iso) => iso.slice(0, 10),
    );
    assert.equal(lines.openedLine, '开桌时间 2026-07-26 · 开桌 Waiter');
    assert.equal(lines.closedLine, '关台时间 2026-07-26 · 关台人 Cashier');
  });
});

describe('resolveOrderHistoryCardClass', () => {
  it('returns distinct classes per emphasis', () => {
    const strong = resolveOrderHistoryCardClass('strong');
    const moderate = resolveOrderHistoryCardClass('moderate');
    const none = resolveOrderHistoryCardClass('none');
    assert.notEqual(strong, moderate);
    assert.notEqual(moderate, none);
    assert.match(strong, /amber-500\/10/);
    assert.match(none, /brand-card/);
  });
});
