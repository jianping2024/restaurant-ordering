import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  normalizeBuffetServiceMode,
  normalizeCountryCode,
  type BuffetServiceMode,
  type PrintLocale,
  type RestaurantCountryCode,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformAdmin } from '@/lib/platform-auth';
import { getTenantAppUrl } from '@/lib/tenant-app-url';
import { loadRestaurantInstallContexts } from '@/lib/ops-restaurant-install-context';
import {
  formatOpsPrimaryLabel,
  isOpsRestaurantDeletable,
  resolveOpsLicenseHealth,
} from '@/lib/ops-license-status';
import { RestaurantDeletePanel } from './RestaurantDeletePanel';
import { RestaurantDetailActions } from './RestaurantDetailActions';
import { RestaurantEditPanel } from './RestaurantEditPanel';
import { RestaurantProPanel } from './RestaurantProPanel';

type PageProps = { params: Promise<{ id: string }> };

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const platformAdmin = await getPlatformAdmin();
  const isAdmin = platformAdmin?.account.role === 'admin';

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, pro_valid_until, created_at, owner_id, owner_email, print_locale, country_code, buffet_service_mode, address, phone, suspended_at, suspension_reason, deployment_mode, license_valid_until, license_checked_at, license_offline_grace_days',
    )
    .eq('id', id)
    .maybeSingle();

  if (!row) notFound();

  const owner = row.owner_id ? await admin.auth.admin.getUserById(row.owner_id) : null;
  const tenantUrl = getTenantAppUrl();
  const menuUrl = `${tenantUrl}/${row.slug}/menu`;
  const countryCode = (normalizeCountryCode(row.country_code ?? 'PT') ?? 'PT') as RestaurantCountryCode;
  const buffetServiceMode = normalizeBuffetServiceMode(row.buffet_service_mode) as BuffetServiceMode;

  const installById = await loadRestaurantInstallContexts(admin, [row.id]);
  const installCtx = installById.get(row.id)!;
  const health = resolveOpsLicenseHealth({
    deploymentMode: row.deployment_mode,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    licenseValidUntil: row.license_valid_until,
    licenseCheckedAt: row.license_checked_at,
    lastCheckinAt: installCtx.lastCheckinAt,
    installPhase: installCtx.installPhase,
    offlineGraceDays: row.license_offline_grace_days,
  });
  const ownerEmail = row.owner_email || owner?.data?.user?.email || null;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span
          className={
            health.primary.kind === 'suspended'
              ? 'text-amber-400'
              : health.primary.kind === 'install'
                ? 'text-sky-400'
                : 'text-emerald-500'
          }
        >
          {formatOpsPrimaryLabel(health.primary)}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">
          {row.deployment_mode === 'on_prem' ? '本地安装' : '云'}
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-500">
          创建于 {new Date(row.created_at).toLocaleString('zh-CN')}
        </span>
        <Link
          href={`/ops/licenses/${row.id}`}
          className="ml-auto text-amber-400 hover:underline"
        >
          授权管理 →
        </Link>
      </div>

      <RestaurantEditPanel
        restaurantId={row.id}
        readOnly={!isAdmin}
        initial={{
          name: row.name,
          slug: row.slug,
          address: row.address,
          phone: row.phone,
          printLocale: row.print_locale as PrintLocale,
          countryCode,
          buffetServiceMode,
        }}
      />

      <RestaurantProPanel
        restaurantId={row.id}
        readOnly={!isAdmin}
        initial={{
          plan: row.plan,
          proValidUntil: row.pro_valid_until,
        }}
      />

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">店主账号</h2>
        <p className="mt-1 text-sm text-zinc-500">邮箱只读；重置密码写入审计日志</p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">店主邮箱</dt>
            <dd>{ownerEmail || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">菜单链接</dt>
            <dd>
              <a
                href={menuUrl}
                className="break-all text-amber-400 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                {menuUrl}
              </a>
            </dd>
          </div>
        </dl>
        <RestaurantDetailActions restaurantId={row.id} embedded />
      </section>

      <RestaurantDeletePanel
        restaurantId={row.id}
        slug={row.slug}
        deletable={isOpsRestaurantDeletable(health)}
        readOnly={!isAdmin}
      />
    </div>
  );
}
