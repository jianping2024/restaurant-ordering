import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

type PageProps = { params: Promise<{ id: string }> };

type StatRow = {
  business_date: string;
  revenue: number;
  adult_count: number;
  child_count: number;
  customer_count: number;
  qualifying_session_count: number;
  sealed_at: string;
};

type TopRow = {
  business_date: string;
  rank: number;
  item_id: string;
  name_pt: string;
  name_zh: string | null;
  consumed_quantity: number;
  amount: number;
};

export default async function BusinessReportPage({ params }: PageProps) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, deployment_mode, daily_business_report_enabled')
    .eq('id', id)
    .maybeSingle();

  if (!restaurant) notFound();

  const onPrem = restaurant.deployment_mode === 'on_prem';
  const enabled = Boolean(restaurant.daily_business_report_enabled);

  const { data: stats } = await admin
    .from('analytics_daily_restaurant_stats')
    .select(
      'business_date, revenue, adult_count, child_count, customer_count, qualifying_session_count, sealed_at',
    )
    .eq('restaurant_id', id)
    .order('business_date', { ascending: false })
    .limit(30);

  const dates = (stats || []).map((s) => s.business_date as string);
  let topRows: TopRow[] = [];
  if (dates.length > 0) {
    const { data: tops } = await admin
      .from('analytics_daily_menu_item_stats')
      .select(
        'business_date, rank, item_id, name_pt, name_zh, consumed_quantity, amount',
      )
      .eq('restaurant_id', id)
      .in('business_date', dates)
      .order('business_date', { ascending: false })
      .order('rank', { ascending: true });
    topRows = (tops || []) as TopRow[];
  }

  const topsByDate = new Map<string, TopRow[]>();
  for (const row of topRows) {
    const list = topsByDate.get(row.business_date) || [];
    list.push(row);
    topsByDate.set(row.business_date, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">经营日报</h2>
        <p className="mt-1 text-sm text-zinc-500">
          店内密封的每日营业额、客流与消费量 Top10（平台镜像）。不是店主「增值分析」页。
        </p>
        {!onPrem ? (
          <p className="mt-3 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
            云店数据已在云库；本页主要服务本地安装上报。下方仍可读该店已有日密封行（若有）。
          </p>
        ) : !enabled ? (
          <p className="mt-3 rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            未启用每日上报。可在{' '}
            <Link href={`/ops/restaurants/${id}`} className="underline">
              概览编辑
            </Link>{' '}
            勾选「启用每日经营日报上报」。历史已上传数据仍会显示。
          </p>
        ) : (
          <p className="mt-3 text-sm text-emerald-400/90">已启用每日上报（店端日切上传）。</p>
        )}
      </div>

      {(stats || []).length === 0 ? (
        <p className="text-sm text-zinc-500">暂无经营日报数据。</p>
      ) : (
        <ul className="space-y-4">
          {(stats as StatRow[]).map((day) => {
            const tops = topsByDate.get(day.business_date) || [];
            return (
              <li
                key={day.business_date}
                className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-medium text-white">{day.business_date}</h3>
                  <span className="text-xs text-zinc-500">
                    密封 {new Date(day.sealed_at).toLocaleString('zh-CN')}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div>
                    <dt className="text-zinc-500">营业额</dt>
                    <dd className="font-mono">€{Number(day.revenue).toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">客流</dt>
                    <dd>{day.customer_count}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">成人 / 儿童</dt>
                    <dd>
                      {day.adult_count} / {day.child_count}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-zinc-500">计费餐次</dt>
                    <dd>{day.qualifying_session_count}</dd>
                  </div>
                </dl>
                {tops.length > 0 ? (
                  <div className="mt-4">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      消费量 Top10
                    </h4>
                    <table className="mt-2 w-full text-left text-xs">
                      <thead className="text-zinc-500">
                        <tr>
                          <th className="py-1 pr-2">#</th>
                          <th className="py-1 pr-2">菜品</th>
                          <th className="py-1 pr-2">份数</th>
                          <th className="py-1">金额</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tops.map((t) => (
                          <tr key={`${t.business_date}-${t.rank}`} className="border-t border-zinc-800">
                            <td className="py-1 pr-2">{t.rank}</td>
                            <td className="py-1 pr-2">{t.name_zh || t.name_pt}</td>
                            <td className="py-1 pr-2 font-mono">{t.consumed_quantity}</td>
                            <td className="py-1 font-mono">€{Number(t.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">当日无 Top10 行。</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
