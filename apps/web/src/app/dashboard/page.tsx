import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  DashboardOverviewPrimaryClient,
  DashboardOverviewSecondaryClient,
} from '@/components/dashboard/DashboardPageClient';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import {
  loadDashboardOverviewPrimary,
  loadDashboardOverviewSecondary,
} from '@/lib/dashboard-overview';
import { can } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function PrimarySkeleton() {
  return (
    <div className="animate-pulse mb-6 space-y-6" aria-hidden>
      <div className="h-4 w-40 rounded bg-brand-border/60" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-brand-border bg-brand-card" />
        ))}
      </div>
      <div className="h-20 rounded-2xl border border-brand-border bg-brand-card" />
    </div>
  );
}

function SecondarySkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-40 rounded-2xl border border-brand-border bg-brand-card" />
      <div className="h-64 rounded-2xl border border-brand-border bg-brand-card" />
    </div>
  );
}

async function OverviewPrimary({
  restaurantId,
  nowIso,
  includePendingAbnormal,
}: {
  restaurantId: string;
  nowIso: string;
  includePendingAbnormal: boolean;
}) {
  const admin = createAdminClient();
  const primary = await loadDashboardOverviewPrimary(admin, restaurantId, new Date(nowIso), {
    includePendingAbnormal,
  });
  return <DashboardOverviewPrimaryClient primary={primary} />;
}

async function OverviewSecondary({
  restaurantId,
  nowIso,
}: {
  restaurantId: string;
  nowIso: string;
}) {
  const admin = createAdminClient();
  const secondary = await loadDashboardOverviewSecondary(admin, restaurantId, new Date(nowIso));
  return <DashboardOverviewSecondaryClient secondary={secondary} />;
}

// 数据概览：首屏 KPI/待办与次屏反馈/热销分路加载；鉴权与 layout 共用请求缓存
export default async function DashboardPage() {
  const ctx = await getDashboardOperationalContext('dashboard.overview.view');
  if ('error' in ctx) notFound();

  const principalCaps = await loadPrincipalWithCapabilities();
  const includePendingAbnormal = Boolean(
    principalCaps && can(principalCaps.capabilities, 'dashboard.abnormal_ops.view'),
  );

  const nowIso = new Date().toISOString();

  return (
    <div>
      <Suspense fallback={<PrimarySkeleton />}>
        <OverviewPrimary
          restaurantId={ctx.restaurantId}
          nowIso={nowIso}
          includePendingAbnormal={includePendingAbnormal}
        />
      </Suspense>
      <Suspense fallback={<SecondarySkeleton />}>
        <OverviewSecondary restaurantId={ctx.restaurantId} nowIso={nowIso} />
      </Suspense>
    </div>
  );
}
