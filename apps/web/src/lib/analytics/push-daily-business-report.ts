import {
  ANALYTICS_DAILY_SCHEMA_VERSION,
  type DailyBusinessReport,
} from '@mesa/shared';
import type { MenuItemAgg } from '@/lib/analytics/aggregate-items';
import type { DailyStatMetrics } from '@/lib/analytics/daily-stats';
import { loadPlatformLicenseConfig } from '@/lib/license-platform-config';

export function buildDailyBusinessReport(input: {
  restaurantId: string;
  metrics: DailyStatMetrics;
  topItems: MenuItemAgg[];
}): DailyBusinessReport {
  return {
    schemaVersion: ANALYTICS_DAILY_SCHEMA_VERSION,
    restaurantId: input.restaurantId,
    businessDate: input.metrics.businessDate,
    metrics: {
      revenue: input.metrics.revenue,
      adultCount: input.metrics.adultCount,
      childCount: input.metrics.childCount,
      customerCount: input.metrics.customerCount,
      qualifyingSessionCount: input.metrics.qualifyingSessionCount,
    },
    topItems: input.topItems.map((item, index) => ({
      rank: index + 1,
      itemId: item.itemId,
      namePt: item.namePt,
      nameEn: item.nameEn ?? null,
      nameZh: item.nameZh ?? null,
      consumedQuantity: item.consumedQuantity,
      amount: item.amount,
    })),
  };
}

/** Sole upload path for sealed 经营日报 → platform (check-in credential). */
export async function pushDailyBusinessReport(
  report: DailyBusinessReport,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const config = loadPlatformLicenseConfig();
  if (!config) {
    return { ok: false, error: 'platform_license_unconfigured' };
  }

  try {
    const res = await fetch(`${config.platformUrl}/api/platform/analytics/daily-report`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.checkinCredential}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(report),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: json.error || 'upload_failed', status: res.status };
    }
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'upload_network_error',
    };
  }
}
