/**
 * Sole faces for dashboard / analytics / overview *metric values* (not titles).
 * Money → `.mesa-money`; counts / percents → body + tabular. Never `font-heading` on values.
 */
export const DASHBOARD_METRIC_TYPE = {
  money: 'mesa-money',
  figure: 'font-semibold tabular-nums',
} as const;
