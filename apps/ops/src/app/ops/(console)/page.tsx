import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function OpsHomePage() {
  const admin = createAdminClient();
  const { count } = await admin.from('restaurants').select('id', { count: 'exact', head: true });

  return (
    <div>
      <h1 className="text-2xl font-semibold">运营概览</h1>
      <p className="mt-2 text-zinc-400">平台租户与开店管理（P0）</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">入驻餐厅</p>
          <p className="mt-1 text-3xl font-semibold">{count ?? 0}</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm text-zinc-500">快捷操作</p>
          <Link
            href="/ops/restaurants/new"
            className="mt-3 inline-block rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
          >
            创建餐厅 + 店主
          </Link>
        </div>
      </div>
    </div>
  );
}
