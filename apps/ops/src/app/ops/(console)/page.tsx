import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { listTopPrintFailureRestaurants, PRINT_FAIL_WINDOW_MS } from '@/lib/ops-print-summary';
import { getPlatformAdmin } from '@/lib/platform-auth';
import { isRestaurantSuspended } from '@mesa/shared';

const RECENT_LIMIT = 8;
const PRINT_ISSUE_LIMIT = 10;

export default async function OpsHomePage() {
  const platformAdmin = await getPlatformAdmin();
  const isAdmin = platformAdmin?.account.role === 'admin';
  const admin = createAdminClient();
  const failedSince = new Date(Date.now() - PRINT_FAIL_WINDOW_MS).toISOString();

  const [
    { count: restaurantCount },
    { count: suspendedCount },
    { data: recentRestaurants },
    printIssues,
  ] = await Promise.all([
    admin.from('restaurants').select('id', { count: 'exact', head: true }),
    admin
      .from('restaurants')
      .select('id', { count: 'exact', head: true })
      .not('suspended_at', 'is', null),
    admin
      .from('restaurants')
      .select('id, name, slug, plan, created_at, suspended_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_LIMIT),
    listTopPrintFailureRestaurants(admin, { limit: PRINT_ISSUE_LIMIT, sinceIso: failedSince }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">运营概览</h1>
      <p className="mt-2 text-zinc-400">平台租户与开店管理</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">入驻餐厅</p>
          <p className="mt-1 text-3xl font-semibold">{restaurantCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">已暂停</p>
          <p className="mt-1 text-3xl font-semibold text-amber-400">{suspendedCount ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">近 7 日打印失败（有任务的店）</p>
          <p className="mt-1 text-3xl font-semibold text-red-400">{printIssues.length}</p>
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-6">
          <Link
            href="/ops/restaurants/new"
            className="inline-block rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            创建餐厅 + 店主
          </Link>
        </div>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="text-lg font-medium">近期新建</h2>
          {(recentRestaurants || []).length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">暂无餐厅</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {(recentRestaurants || []).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <Link href={`/ops/restaurants/${r.id}`} className="text-amber-400 hover:underline">
                      {r.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-xs text-zinc-500">{r.slug}</p>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <p>{r.plan}</p>
                    <p>{new Date(r.created_at).toLocaleDateString('zh-CN')}</p>
                    {isRestaurantSuspended(r.suspended_at) ? (
                      <p className="text-amber-400">已暂停</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/ops/restaurants" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            查看全部 →
          </Link>
        </section>

        <section>
          <h2 className="text-lg font-medium">打印异常摘要（近 7 日失败任务）</h2>
          {printIssues.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">暂无失败任务</p>
          ) : (
            <ul className="mt-3 divide-y divide-zinc-800 rounded-lg border border-zinc-800">
              {printIssues.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <Link href={`/ops/restaurants/${r.id}/print`} className="text-amber-400 hover:underline">
                    {r.name}
                  </Link>
                  <span className="shrink-0 text-red-400">{r.failedCount} 次失败</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/ops/print/jobs" className="mt-2 inline-block text-sm text-zinc-400 hover:text-zinc-200">
            跨店打印任务 →
          </Link>
        </section>
      </div>
    </div>
  );
}
