import { AUDIT_EVENT, type OperationLogActionType } from '@/lib/audit/types';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { OperationLogRow } from '@/lib/operation-logs/types';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function itemsSummary(after: Record<string, unknown>): string {
  const items = after.items;
  if (!Array.isArray(items) || items.length === 0) return '';
  return items
    .slice(0, 5)
    .map((row) => {
      if (!row || typeof row !== 'object') return '';
      const r = row as { itemName?: unknown; qty?: unknown };
      const name = asString(r.itemName) || '—';
      const qty = asNumber(r.qty);
      return qty != null && qty !== 1 ? `${name}×${qty}` : name;
    })
    .filter(Boolean)
    .join('、');
}

/** Sole human-readable 详情 cell for operation log rows. */
export function formatOperationLogDetail(lang: UILanguage, row: OperationLogRow): string {
  const t = getMessages(lang).operationLogs;
  const after = row.after_data || {};
  const before = row.before_data || {};

  switch (row.action_type) {
    case AUDIT_EVENT.SESSION_OPENED: {
      const adults = asNumber(after.adultCount) ?? 0;
      const children = asNumber(after.childCount) ?? 0;
      return t.detailOpen.replace('{adults}', String(adults)).replace('{children}', String(children));
    }
    case AUDIT_EVENT.GUEST_COUNT_CHANGED: {
      const fromAdults = asNumber(before.adultCount) ?? 0;
      const fromChildren = asNumber(before.childCount) ?? 0;
      const toAdults = asNumber(after.adultCount) ?? 0;
      const toChildren = asNumber(after.childCount) ?? 0;
      return t.detailGuestCount
        .replace('{fromAdults}', String(fromAdults))
        .replace('{fromChildren}', String(fromChildren))
        .replace('{toAdults}', String(toAdults))
        .replace('{toChildren}', String(toChildren));
    }
    case AUDIT_EVENT.TABLE_CLOSED: {
      const amount = asNumber(after.amount);
      const kind = asString(after.closeKind);
      if (kind === 'paid') {
        return amount != null
          ? t.detailClosePaid.replace('{amount}', amount.toFixed(2))
          : t.detailClosePaidNoAmount;
      }
      return amount != null
        ? t.detailCloseFrontdesk.replace('{amount}', amount.toFixed(2))
        : t.detailCloseFrontdeskNoAmount;
    }
    case AUDIT_EVENT.UNPAID_TABLE_CLOSED: {
      const gap = asNumber(after.amountImpact) ?? asNumber(before.gap);
      return gap != null
        ? t.detailForceClose.replace('{gap}', gap.toFixed(2))
        : t.detailForceCloseNoAmount;
    }
    case AUDIT_EVENT.TABLE_TRANSFERRED:
      return t.detailTransfer
        .replace('{from}', asString(before.fromTableName) || '—')
        .replace('{to}', asString(after.toTableName) || '—');
    case AUDIT_EVENT.TABLE_MERGED:
      return t.detailMerge
        .replace('{from}', asString(before.sourceTableName) || '—')
        .replace('{to}', asString(after.targetTableName) || '—');
    case AUDIT_EVENT.TABLE_PARTY: {
      const action = asString(after.action);
      const partyName = asString(after.partyName) || '—';
      const tables = Array.isArray(after.tableNames)
        ? after.tableNames.map((v) => asString(v)).filter(Boolean).join('、')
        : '';
      if (action === 'create') return t.detailPartyCreate.replace('{name}', partyName);
      if (action === 'rename') {
        return t.detailPartyRename
          .replace('{from}', asString(before.partyName) || '—')
          .replace('{to}', partyName);
      }
      if (action === 'dissolve') return t.detailPartyDissolve.replace('{name}', partyName);
      if (action === 'add_tables') {
        return t.detailPartyAdd
          .replace('{name}', partyName)
          .replace('{tables}', tables || '—');
      }
      if (action === 'remove_table') {
        return t.detailPartyRemove
          .replace('{name}', partyName)
          .replace('{tables}', tables || '—');
      }
      return partyName;
    }
    case AUDIT_EVENT.CHECKOUT_REQUESTED: {
      const total = asNumber(after.totalAmount);
      return total != null
        ? t.detailCheckout.replace('{amount}', total.toFixed(2))
        : t.detailCheckoutNoAmount;
    }
    case AUDIT_EVENT.PAYMENT_CONFIRMED: {
      const amount = asNumber(after.amount);
      const name = asString(after.personName) || '—';
      return amount != null
        ? t.detailPayment.replace('{name}', name).replace('{amount}', amount.toFixed(2))
        : t.detailPaymentNoAmount.replace('{name}', name);
    }
    case AUDIT_EVENT.ORDER_APPENDED: {
      const summary = itemsSummary(after);
      return summary || '—';
    }
    case AUDIT_EVENT.ITEM_QTY_DECREMENTED: {
      const name = asString(after.itemName) || asString(before.itemName) || '—';
      const fromQty = asNumber(before.qty) ?? 0;
      const toQty = asNumber(after.qty) ?? 0;
      return t.detailDecrement
        .replace('{name}', name)
        .replace('{from}', String(fromQty))
        .replace('{to}', String(toQty));
    }
    case AUDIT_EVENT.KITCHEN_PREP:
    case AUDIT_EVENT.KITCHEN_PREP_REPRINT:
    case AUDIT_EVENT.KITCHEN_SERVE: {
      const summary = itemsSummary(after);
      return summary || '—';
    }
    case AUDIT_EVENT.BUFFET_PRICE_RULE: {
      const op = asString(after.op) || asString(before.op);
      const kindKey = asString(after.calendarKind) || asString(before.calendarKind);
      const kind =
        kindKey === 'weekend'
          ? t.buffetKindWeekend
          : kindKey === 'holiday'
            ? t.buffetKindHoliday
            : kindKey === 'special'
              ? t.buffetKindSpecial
              : t.buffetKindWeekday;
      const buffet = asString(after.buffetName) || asString(before.buffetName) || '—';
      const slot = asString(after.slotName) || asString(before.slotName) || '—';
      const from = asString(after.validFrom) || asString(before.validFrom) || '—';
      const toRaw = after.validTo ?? before.validTo;
      const to = typeof toRaw === 'string' && toRaw.trim() ? toRaw.trim().slice(0, 10) : '';
      const period = to
        ? t.detailBuffetRulePeriodRange.replace('{from}', from).replace('{to}', to)
        : t.detailBuffetRulePeriodOpen.replace('{from}', from);
      const snap = op === 'delete' ? before : after;
      const adult = asNumber(snap.adultPrice);
      const child = asNumber(snap.childPrice);
      const adultStr = adult != null ? adult.toFixed(2) : '—';
      const childStr = child != null ? child.toFixed(2) : '—';
      if (op === 'create') {
        return t.detailBuffetRuleCreate
          .replace('{buffet}', buffet)
          .replace('{slot}', slot)
          .replace('{kind}', kind)
          .replace('{adult}', adultStr)
          .replace('{child}', childStr)
          .replace('{period}', period);
      }
      if (op === 'delete') {
        return t.detailBuffetRuleDelete
          .replace('{buffet}', buffet)
          .replace('{slot}', slot)
          .replace('{kind}', kind)
          .replace('{period}', period);
      }
      if (op === 'toggle') {
        const on = after.isActive === true;
        return (on ? t.detailBuffetRuleToggleOn : t.detailBuffetRuleToggleOff)
          .replace('{buffet}', buffet)
          .replace('{slot}', slot)
          .replace('{kind}', kind);
      }
      return t.detailBuffetRuleUpdate
        .replace('{buffet}', buffet)
        .replace('{slot}', slot)
        .replace('{kind}', kind)
        .replace('{adult}', adultStr)
        .replace('{child}', childStr)
        .replace('{period}', period);
    }
    case AUDIT_EVENT.BUFFET_CALENDAR: {
      const op = asString(after.op);
      if (op === 'delete') {
        return t.detailBuffetCalendarDelete.replace(
          '{date}',
          asString(after.removedDate) || asString(before.onDate) || '—',
        );
      }
      const rows = Array.isArray(after.rows) ? after.rows : [];
      if (rows.length === 1) {
        const row = rows[0] as { on_date?: unknown; kind?: unknown };
        const kindRaw = asString(row.kind);
        const kindLabel =
          kindRaw === 'special' ? t.buffetKindSpecial : t.buffetKindHoliday;
        return t.detailBuffetCalendarUpsertOne
          .replace('{kind}', kindLabel)
          .replace('{date}', asString(row.on_date) || '—');
      }
      return t.detailBuffetCalendarUpsertMany.replace('{n}', String(rows.length));
    }
    case AUDIT_EVENT.BUFFET_FRIDAY_POLICY: {
      const time = asString(after.fridayWeekendFrom);
      if (!time) return t.detailBuffetFridayOff;
      return t.detailBuffetFridayOn.replace('{time}', time.slice(0, 5));
    }
    default:
      return '—';
  }
}

/**
 * Sole human-readable 桌位 cell.
 * List search `q` only matches `after_data.tableName` (see `OPERATION_LOG_Q_TABLE_JSON_PATH`);
 * transfer/merge/party labels below are display-only and not covered by `q`.
 */
export function operationLogTableLabel(row: OperationLogRow): string {
  const after = row.after_data || {};
  const before = row.before_data || {};
  if (row.action_type === AUDIT_EVENT.TABLE_TRANSFERRED) {
    return `${asString(before.fromTableName) || '—'}→${asString(after.toTableName) || '—'}`;
  }
  if (row.action_type === AUDIT_EVENT.TABLE_MERGED) {
    return `${asString(before.sourceTableName) || '—'}→${asString(after.targetTableName) || '—'}`;
  }
  if (row.action_type === AUDIT_EVENT.TABLE_PARTY) {
    return asString(after.partyName) || '—';
  }
  return asString(after.tableName) || '—';
}

export function operationLogActionLabel(
  lang: UILanguage,
  actionType: OperationLogActionType,
): string {
  const t = getMessages(lang).operationLogs.actions;
  return t[actionType] ?? actionType;
}
