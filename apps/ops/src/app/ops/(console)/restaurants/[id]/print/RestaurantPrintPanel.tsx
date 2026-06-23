'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import PrintDevicesClient from '../../../print/devices/PrintDevicesClient';
import PrintJobsClient from '../../../print/jobs/PrintJobsClient';
import PrintPairingsClient from '../../../print/pairings/PrintPairingsClient';

type PrintHealth = {
  activeDeviceCount: number;
  onlineDeviceCount: number;
  recentFailedCount: number;
  lastHeartbeat: string | null;
};

export function RestaurantPrintPanel({ restaurantId }: { restaurantId: string }) {
  const [health, setHealth] = useState<PrintHealth | null>(null);
  const [tab, setTab] = useState<'devices' | 'jobs' | 'pairings'>('devices');

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/print-health`, {
        credentials: 'include',
      });
      if (res.ok) {
        const json = (await res.json()) as PrintHealth;
        setHealth(json);
      }
    })();
  }, [restaurantId]);

  return (
    <div>
      {health ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500">有效设备</p>
            <p className="mt-1 text-2xl font-semibold">{health.activeDeviceCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500">在线设备</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-400">{health.onlineDeviceCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500">近 7 日失败任务</p>
            <p className="mt-1 text-2xl font-semibold text-red-400">{health.recentFailedCount}</p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-sm text-zinc-500">最近心跳</p>
            <p className="mt-1 text-sm">
              {health.lastHeartbeat
                ? new Date(health.lastHeartbeat).toLocaleString('zh-CN')
                : '—'}
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-6 text-zinc-500">加载打印健康…</p>
      )}

      <nav className="mb-6 flex gap-4 border-b border-zinc-800 text-sm">
        {(
          [
            ['devices', '设备'],
            ['jobs', '任务'],
            ['pairings', '配对码'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              tab === key
                ? '-mb-px border-b-2 border-amber-400 pb-2 text-white'
                : 'pb-2 text-zinc-400 hover:text-zinc-200'
            }
          >
            {label}
          </button>
        ))}
        <Link
          href={`/ops/print/devices?restaurantId=${restaurantId}`}
          className="ml-auto pb-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          在全局打印页打开 →
        </Link>
      </nav>

      {tab === 'devices' ? (
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintDevicesClient fixedRestaurantId={restaurantId} />
        </Suspense>
      ) : null}
      {tab === 'jobs' ? (
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintJobsClient fixedRestaurantId={restaurantId} />
        </Suspense>
      ) : null}
      {tab === 'pairings' ? (
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintPairingsClient fixedRestaurantId={restaurantId} />
        </Suspense>
      ) : null}
    </div>
  );
}
