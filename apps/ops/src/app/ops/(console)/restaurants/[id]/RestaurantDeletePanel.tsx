'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { BUSINESS_STATUS_LABEL } from '@/lib/ops-license-status';

export function RestaurantDeletePanel({
  restaurantId,
  slug,
  deletable,
  readOnly = false,
}: {
  restaurantId: string;
  slug: string;
  /** Server-resolved via isOpsRestaurantDeletable — sole gate mirrored in UI. */
  deletable: boolean;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [confirmSlug, setConfirmSlug] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const slugMatches = confirmSlug.trim().toLowerCase() === slug.toLowerCase();

  const runDelete = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirmSlug }),
      });
      const json = (await res.json()) as {
        error?: string;
        message?: string;
        detail?: string;
      };
      if (!res.ok) {
        setError(json.message || json.detail || json.error || '删除失败');
        setConfirmOpen(false);
        return;
      }
      router.replace('/ops');
      router.refresh();
    } catch {
      setError('网络错误');
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (readOnly) return null;

  return (
    <section className="mt-10 rounded-lg border border-red-900/60 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium text-red-300">删除餐厅</h2>
      <p className="mt-1 text-sm text-zinc-500">
        不可恢复。将清除平台侧该店全部业务数据、员工/店主登录账号，以及菜单图片。本地安装门店的本机数据不会自动清除。
      </p>

      {!deletable ? (
        <p className="mt-4 text-sm text-amber-400">
          当前状态为「{BUSINESS_STATUS_LABEL.open}」，不可删除。请先在授权管理中暂停后再删。
        </p>
      ) : (
        <>
          <label className="mt-4 block text-sm text-zinc-400">
            输入 slug <code className="text-zinc-200">{slug}</code> 确认
            <input
              type="text"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              placeholder={slug}
            />
          </label>
          <button
            type="button"
            disabled={loading || !slugMatches}
            onClick={() => setConfirmOpen(true)}
            className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            删除此餐厅
          </button>
        </>
      )}

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      <ConfirmModal
        open={confirmOpen}
        onClose={() => {
          if (!loading) setConfirmOpen(false);
        }}
        title="确认删除餐厅"
        message={`将永久删除「${slug}」及其平台侧全部数据。此操作不可撤销。`}
        confirmLabel="确认删除"
        cancelLabel="取消"
        variant="danger"
        confirming={loading}
        onConfirm={() => void runDelete()}
      />
    </section>
  );
}
