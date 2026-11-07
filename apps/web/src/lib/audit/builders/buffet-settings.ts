import type { BuffetPriceRule } from '@/types';
import type { AuditEventDefinition } from '@/lib/audit/types';
import { AUDIT_EVENT } from '@/lib/audit/types';

function ruleSnapshot(rule: BuffetPriceRule | null): Record<string, unknown> {
  if (!rule) return {};
  return {
    buffetId: rule.buffet_id,
    timeSlotId: rule.time_slot_id,
    calendarKind: rule.calendar_kind,
    validFrom: rule.valid_from?.slice(0, 10) ?? '',
    validTo: rule.valid_to?.slice(0, 10) || null,
    adultPrice: Number(rule.adult_price),
    childPrice: Number(rule.child_price),
    priority: rule.priority,
    isActive: rule.is_active,
    note: rule.note,
  };
}

export type BuffetPriceRuleAuditOp = 'create' | 'update' | 'delete' | 'toggle';

export type BuffetPriceRuleAuditContext = {
  ruleId: string;
  op: BuffetPriceRuleAuditOp;
  before: BuffetPriceRule | null;
  after: BuffetPriceRule | null;
  /** Display labels resolved at write time (not IDs alone). */
  buffetName?: string;
  slotName?: string;
};

export const buffetPriceRuleDefinition: AuditEventDefinition<BuffetPriceRuleAuditContext> = {
  actionType: AUDIT_EVENT.BUFFET_PRICE_RULE,
  entityType: 'buffet_price_rule',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.ruleId,
      amountImpact: 0,
      beforeData: ruleSnapshot(context.before),
      afterData: {
        ...ruleSnapshot(context.after),
        op: context.op,
        ...(context.buffetName ? { buffetName: context.buffetName } : {}),
        ...(context.slotName ? { slotName: context.slotName } : {}),
      },
    };
  },
};

export type BuffetCalendarAuditContext = {
  restaurantId: string;
  op: 'upsert' | 'delete';
  rows: Array<{ on_date: string; kind: 'holiday' | 'special' }>;
  removedDate?: string;
  removedKind?: 'holiday' | 'special' | null;
};

export const buffetCalendarDefinition: AuditEventDefinition<BuffetCalendarAuditContext> = {
  actionType: AUDIT_EVENT.BUFFET_CALENDAR,
  entityType: 'buffet_calendar_override',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.restaurantId,
      amountImpact: 0,
      beforeData:
        context.op === 'delete'
          ? {
              onDate: context.removedDate ?? '',
              kind: context.removedKind ?? null,
            }
          : {},
      afterData: {
        op: context.op,
        rows: context.rows,
        ...(context.removedDate ? { removedDate: context.removedDate } : {}),
        ...(context.removedKind != null ? { removedKind: context.removedKind } : {}),
      },
    };
  },
};

export type BuffetFridayPolicyAuditContext = {
  restaurantId: string;
  beforeFrom: string | null;
  afterFrom: string | null;
};

export const buffetFridayPolicyDefinition: AuditEventDefinition<BuffetFridayPolicyAuditContext> = {
  actionType: AUDIT_EVENT.BUFFET_FRIDAY_POLICY,
  entityType: 'restaurant',
  createsAbnormal: false,
  build(context) {
    return {
      entityId: context.restaurantId,
      amountImpact: 0,
      beforeData: { fridayWeekendFrom: context.beforeFrom },
      afterData: { fridayWeekendFrom: context.afterFrom },
    };
  },
};
