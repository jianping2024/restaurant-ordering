import { notFound } from 'next/navigation';
import {
  countryCodeLabel,
  isRestaurantSuspended,
  normalizeCountryCode,
  normalizeRestaurantFeatureFlags,
  type PrintLocale,
  type RestaurantCountryCode,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPlatformAdmin } from '@/lib/platform-auth';
import { getTenantAppUrl } from '@/lib/tenant-app-url';
import { RestaurantDetailActions } from './RestaurantDetailActions';
import { RestaurantEditPanel } from './RestaurantEditPanel';
import { RestaurantSuspensionActions } from './RestaurantSuspensionActions';

type PageProps = { params: Promise<{ id: string }> };

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const platformAdmin = await getPlatformAdmin();
  const isAdmin = platformAdmin?.account.role === 'admin';

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, created_at, owner_id, print_locale, country_code, feature_flags, address, phone, suspended_at, suspension_reason',
    )
    .eq('id', id)
    .maybeSingle();

  if (!row) notFound();

  const { data: owner } = await admin.auth.admin.getUserById(row.owner_id);
  const tenantUrl = getTenantAppUrl();
  const menuUrl = `${tenantUrl}/${row.slug}/menu`;
  const suspended = isRestaurantSuspended(row.suspended_at);
  const featureFlags = normalizeRestaurantFeatureFlags(row.feature_flags);
  const countryCode = (normalizeCountryCode(row.country_code ?? 'PT') ?? 'PT') as RestaurantCountryCode;

  return (
    <div>
      {suspended ? (
        <p className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
          已暂停营业
          {row.suspension_reason ? ` — ${row.suspension_reason}` : ''}
        </p>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">slug</dt>
          <dd className="font-mono">{row.slug}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">plan</dt>
          <dd>{row.plan}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">店主邮箱</dt>
          <dd>{owner?.user?.email || '—'}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">print_locale</dt>
          <dd>{row.print_locale}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">国家/地区</dt>
          <dd>{countryCodeLabel(countryCode)}</dd>
        </div>
        {row.address ? (
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">地址</dt>
            <dd>{row.address}</dd>
          </div>
        ) : null}
        {row.phone ? (
          <div>
            <dt className="text-zinc-500">电话</dt>
            <dd>{row.phone}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-zinc-500">创建时间</dt>
          <dd>{new Date(row.created_at).toLocaleString('zh-CN')}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">菜单链接</dt>
          <dd>
            <a href={menuUrl} className="break-all text-amber-400 hover:underline" target="_blank" rel="noreferrer">
              {menuUrl}
            </a>
          </dd>
        </div>
      </dl>

      {isAdmin ? (
        <>
          <RestaurantSuspensionActions
            restaurantId={row.id}
            suspended={suspended}
            suspensionReason={row.suspension_reason}
          />
          <RestaurantEditPanel
            restaurantId={row.id}
            initial={{
              name: row.name,
              slug: row.slug,
              plan: row.plan,
              address: row.address,
              phone: row.phone,
              printLocale: row.print_locale as PrintLocale,
              countryCode,
              featureFlags,
            }}
          />
        </>
      ) : (
        <p className="mt-8 text-sm text-zinc-500">
          support 账号仅可查看信息与重置密码；暂停门店、编辑元数据请使用 admin 账号。
        </p>
      )}

      <RestaurantDetailActions restaurantId={row.id} />
    </div>
  );
}
