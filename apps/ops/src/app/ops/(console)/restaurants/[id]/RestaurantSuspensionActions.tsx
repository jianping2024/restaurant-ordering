'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type Props = {
  restaurantId: string;
  suspended: boolean;
  suspensionReason: string | null;
};

export function RestaurantSuspensionActions({ restaurantId, suspended, suspensionReason }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState(suspensionReason || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [confirmResume, setConfirmResume] = useState(false);

  const suspend = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || '暂停失败');
        return;
      }
      setConfirmSuspend(false);
      router.refresh();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  const resume = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error || '恢复失败');
        return;
      }
      setConfirmResume(false);
      router.refresh();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">营业状态</h2>
      <p className="mt-1 text-sm text-zinc-500">
        暂停后顾客无法点餐，员工无法登录；店主仍可登录后台查看数据。
      </p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {suspended ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-amber-400">当前已暂停营业</p>
          {suspensionReason ? (
            <p className="text-sm text-zinc-400">
              原因：<span className="text-zinc-200">{suspensionReason}</span>
            </p>
          ) : null}
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmResume(true)}
            className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            恢复营业
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="暂停原因（可选，会展示给顾客）"
            rows={2}
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => setConfirmSuspend(true)}
            className="rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            暂停营业
          </button>
        </div>
      )}

      <ConfirmModal
        open={confirmSuspend}
        onClose={() => setConfirmSuspend(false)}
        title="确认暂停营业"
        message="暂停后该餐厅顾客端与员工登录将不可用，确定继续？"
        confirmLabel="暂停"
        cancelLabel="取消"
        variant="danger"
        confirming={loading}
        onConfirm={() => void suspend()}
      />
      <ConfirmModal
        open={confirmResume}
        onClose={() => setConfirmResume(false)}
        title="确认恢复营业"
        message="恢复后顾客与员工可正常使用，确定继续？"
        confirmLabel="恢复"
        cancelLabel="取消"
        confirming={loading}
        onConfirm={() => void resume()}
      />
    </section>
  );
}
