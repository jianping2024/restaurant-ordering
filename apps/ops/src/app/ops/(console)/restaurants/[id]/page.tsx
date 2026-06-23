import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTenantAppUrl } from '@/lib/tenant-app-url';
import { RestaurantDetailActions } from './RestaurantDetailActions';

type PageProps = { params: Promise<{ id: string }> };

export default async function RestaurantDetailPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: row } = await admin
    .from('restaurants')
    .select(
      'id, name, slug, plan, created_at, owner_id, print_locale, feature_flags, address, phone',
    )
    .eq('id', id)
    .maybeSingle();

  if (!row) notFound();

  const { data: owner } = await admin.auth.admin.getUserById(row.owner_id);
  const tenantUrl = getTenantAppUrl();
  const menuUrl = `${tenantUrl}/${row.slug}/menu`;

  return (
    <div>
      <Link href="/ops/restaurants" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← 返回列表
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{row.name}</h1>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
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
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">功能开关</dt>
          <dd>
            <pre className="mt-1 overflow-x-auto rounded bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-300">
              {JSON.stringify(row.feature_flags ?? {}, null, 2)}
            </pre>
          </dd>
        </div>
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

      <RestaurantDetailActions restaurantId={row.id} />
    </div>
  );
}
