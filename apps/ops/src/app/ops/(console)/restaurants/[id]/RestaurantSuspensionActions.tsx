'use client';

import Link from 'next/link';

type Props = {
  restaurantId: string;
  suspended: boolean;
  suspensionReason: string | null;
};

/** Detail page no longer hosts suspend/resume forms — single entry is /ops/licenses. */
export function RestaurantSuspensionActions({ restaurantId, suspended, suspensionReason }: Props) {
  return (
    <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">营业状态</h2>
      <p className="mt-1 text-sm text-zinc-500">
        暂停、恢复与续期统一在授权管理操作，避免与餐厅元数据编辑混用。
      </p>
      <p className={`mt-3 text-sm ${suspended ? 'text-amber-400' : 'text-emerald-500'}`}>
        {suspended ? '当前已暂停营业' : '当前营业中'}
      </p>
      {suspended && suspensionReason ? (
        <p className="mt-1 text-sm text-zinc-400">
          原因：<span className="text-zinc-200">{suspensionReason}</span>
        </p>
      ) : null}
      <Link
        href={`/ops/licenses/${restaurantId}`}
        className="mt-4 inline-block rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
      >
        前往授权管理
      </Link>
    </section>
  );
}
