import { NextResponse } from 'next/server';
import { isPrintAgentDeviceActive, isPrintAgentDeviceOnline } from '@mesa/shared';
import { PRINT_FAIL_WINDOW_MS } from '@/lib/ops-print-summary';
import { requirePlatformAdmin } from '@/lib/platform-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { error, admin } = await requirePlatformAdmin();
  if (error || !admin) return error!;

  const { id: restaurantId } = await context.params;

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, slug')
    .eq('id', restaurantId)
    .maybeSingle();

  if (!restaurant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: devices, error: devicesError } = await admin
    .from('print_agent_devices')
    .select(
      'id, label, paired_at, valid_until, revoked_at, last_seen, agent_version, last_print_at, last_print_status',
    )
    .eq('restaurant_id', restaurantId)
    .order('last_seen', { ascending: false, nullsFirst: false });

  if (devicesError) {
    return NextResponse.json({ error: 'devices_failed', detail: devicesError.message }, { status: 500 });
  }

  const now = Date.now();
  const failedSince = new Date(now - PRINT_FAIL_WINDOW_MS).toISOString();

  const { count: recentFailedCount, error: failedError } = await admin
    .from('print_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .eq('status', 'failed')
    .gte('created_at', failedSince);

  if (failedError) {
    return NextResponse.json({ error: 'jobs_failed', detail: failedError.message }, { status: 500 });
  }

  const { data: recentJobs, error: recentError } = await admin
    .from('print_jobs')
    .select('id, type, status, created_at, error_message, claimed_by, table_display')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentError) {
    return NextResponse.json({ error: 'recent_jobs_failed', detail: recentError.message }, { status: 500 });
  }

  const deviceRows = devices || [];
  const activeDevices = deviceRows.filter((d) =>
    isPrintAgentDeviceActive(d.revoked_at, d.valid_until, now),
  );
  const onlineDevices = activeDevices.filter((d) => isPrintAgentDeviceOnline(d.last_seen, now));
  const lastHeartbeat = deviceRows.reduce<string | null>((best, d) => {
    if (!d.last_seen) return best;
    if (!best || d.last_seen > best) return d.last_seen;
    return best;
  }, null);

  return NextResponse.json({
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    activeDeviceCount: activeDevices.length,
    onlineDeviceCount: onlineDevices.length,
    recentFailedCount: recentFailedCount ?? 0,
    lastHeartbeat,
    devices: deviceRows.map((d) => ({
      id: d.id,
      label: d.label,
      pairedAt: d.paired_at,
      validUntil: d.valid_until,
      revokedAt: d.revoked_at,
      lastSeen: d.last_seen,
      agentVersion: d.agent_version,
      lastPrintAt: d.last_print_at,
      lastPrintStatus: d.last_print_status,
      active: isPrintAgentDeviceActive(d.revoked_at, d.valid_until, now),
      online: isPrintAgentDeviceOnline(d.last_seen, now),
    })),
    recentJobs: (recentJobs || []).map((j) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      createdAt: j.created_at,
      errorMessage: j.error_message,
      claimedBy: j.claimed_by,
      tableDisplay: j.table_display,
    })),
  });
}
