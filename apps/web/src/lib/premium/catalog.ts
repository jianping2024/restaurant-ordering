import type { PremiumKey } from '@mesa/shared';

/** Nav item id → premium catalog key (sole mapping). */
export const NAV_PREMIUM_KEY = {
  valueAnalytics: 'value_analytics',
  abnormalOps: 'abnormal_ops',
  operationLogs: 'operation_logs',
} as const satisfies Record<string, PremiumKey>;
