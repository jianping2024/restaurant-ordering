import type { SupabaseClient } from '@supabase/supabase-js';
import { sealRestaurantBusinessDay } from '@/lib/analytics/daily-stats';
import {
  buildDailyBusinessReport,
  pushDailyBusinessReport,
} from '@/lib/analytics/push-daily-business-report';
import { addCalendarDays, calendarDateInTimezone } from '@/lib/lisbon-calendar';

export type SealAndReportResult = {
  businessDate: string;
  sealed: boolean;
  reportEnabled: boolean;
  uploadStatus: 'ok' | 'skipped' | 'pending_retry';
  detail: string;
};

/**
 * Cutover phase 2: seal yesterday Lisbon day; upload only when daily_business_report_enabled.
 */
export async function runSealAndReportForRestaurant(
  admin: SupabaseClient,
  restaurantId: string,
  now = new Date(),
): Promise<SealAndReportResult> {
  const today = calendarDateInTimezone(now);
  const businessDate = addCalendarDays(today, -1);

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select('id, daily_business_report_enabled, deployment_mode')
    .eq('id', restaurantId)
    .maybeSingle();

  if (restError || !restaurant) {
    return {
      businessDate,
      sealed: false,
      reportEnabled: false,
      uploadStatus: 'pending_retry',
      detail: restError?.message || 'restaurant_missing',
    };
  }

  const reportEnabled = Boolean(restaurant.daily_business_report_enabled);

  const sealed = await sealRestaurantBusinessDay(admin, restaurantId, businessDate);
  if (!sealed.ok) {
    return {
      businessDate,
      sealed: false,
      reportEnabled,
      uploadStatus: reportEnabled ? 'pending_retry' : 'skipped',
      detail: sealed.message || sealed.code,
    };
  }

  if (!reportEnabled) {
    return {
      businessDate,
      sealed: sealed.written,
      reportEnabled: false,
      uploadStatus: 'skipped',
      detail: 'daily_business_report_disabled',
    };
  }

  if (!sealed.written) {
    return {
      businessDate,
      sealed: false,
      reportEnabled: true,
      uploadStatus: 'skipped',
      detail: 'no_business_activity',
    };
  }

  const report = buildDailyBusinessReport({
    restaurantId,
    metrics: sealed.metrics,
    topItems: sealed.topItems,
  });
  const uploaded = await pushDailyBusinessReport(report);
  if (!uploaded.ok) {
    return {
      businessDate,
      sealed: true,
      reportEnabled: true,
      uploadStatus: 'pending_retry',
      detail: uploaded.error,
    };
  }

  return {
    businessDate,
    sealed: true,
    reportEnabled: true,
    uploadStatus: 'ok',
    detail: 'uploaded',
  };
}
