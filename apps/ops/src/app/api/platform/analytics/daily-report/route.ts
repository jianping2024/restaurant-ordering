import { NextResponse } from 'next/server';
import { hashLicenseSecret, parseDailyBusinessReport } from '@mesa/shared';
import { resolveLicenseLeaseSecret } from '@/lib/license-control';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * On-prem → platform: upsert sealed 经营日报 (metrics + top-10).
 * Auth = Bearer check-in credential (same as license check-in).
 */
export async function POST(req: Request) {
  const leaseSecret = resolveLicenseLeaseSecret();
  if (!leaseSecret) {
    return NextResponse.json({ error: 'lease_secret_unconfigured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!bearer) {
    return NextResponse.json({ error: 'credential_required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const report = parseDailyBusinessReport(body);
  if (!report) {
    return NextResponse.json({ error: 'invalid_report' }, { status: 400 });
  }

  const admin = createAdminClient();
  const hash = hashLicenseSecret(bearer);

  const { data: installation, error: instError } = await admin
    .from('restaurant_installations')
    .select('id, restaurant_id, status, revoked_at')
    .eq('checkin_secret_hash', hash)
    .eq('status', 'claimed')
    .maybeSingle();

  if (instError) {
    return NextResponse.json({ error: 'fetch_failed', detail: instError.message }, { status: 500 });
  }
  if (!installation || installation.revoked_at) {
    return NextResponse.json({ error: 'invalid_credential' }, { status: 401 });
  }
  if (installation.restaurant_id !== report.restaurantId) {
    return NextResponse.json({ error: 'restaurant_mismatch' }, { status: 403 });
  }

  const { data: restaurant, error: restError } = await admin
    .from('restaurants')
    .select('id, deployment_mode, daily_business_report_enabled')
    .eq('id', report.restaurantId)
    .maybeSingle();

  if (restError || !restaurant) {
    return NextResponse.json({ error: 'restaurant_missing' }, { status: 500 });
  }
  if (restaurant.deployment_mode !== 'on_prem') {
    return NextResponse.json({ error: 'not_on_prem' }, { status: 400 });
  }
  if (!restaurant.daily_business_report_enabled) {
    return NextResponse.json({ error: 'report_disabled' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { error: upsertStatsError } = await admin.from('analytics_daily_restaurant_stats').upsert(
    {
      restaurant_id: report.restaurantId,
      business_date: report.businessDate,
      revenue: report.metrics.revenue,
      adult_count: report.metrics.adultCount,
      child_count: report.metrics.childCount,
      customer_count: report.metrics.customerCount,
      qualifying_session_count: report.metrics.qualifyingSessionCount,
      sealed_at: nowIso,
      computed_at: nowIso,
    },
    { onConflict: 'restaurant_id,business_date' },
  );
  if (upsertStatsError) {
    return NextResponse.json(
      { error: 'upsert_stats_failed', detail: upsertStatsError.message },
      { status: 500 },
    );
  }

  const { error: deleteTopError } = await admin
    .from('analytics_daily_menu_item_stats')
    .delete()
    .eq('restaurant_id', report.restaurantId)
    .eq('business_date', report.businessDate);
  if (deleteTopError) {
    return NextResponse.json(
      { error: 'replace_top_failed', detail: deleteTopError.message },
      { status: 500 },
    );
  }

  if (report.topItems.length > 0) {
    const { error: insertTopError } = await admin.from('analytics_daily_menu_item_stats').insert(
      report.topItems.map((item) => ({
        restaurant_id: report.restaurantId,
        business_date: report.businessDate,
        rank: item.rank,
        item_id: item.itemId,
        name_pt: item.namePt,
        name_en: item.nameEn,
        name_zh: item.nameZh,
        consumed_quantity: item.consumedQuantity,
        amount: item.amount,
        sealed_at: nowIso,
      })),
    );
    if (insertTopError) {
      return NextResponse.json(
        { error: 'insert_top_failed', detail: insertTopError.message },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, businessDate: report.businessDate });
}
