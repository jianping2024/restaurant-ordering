'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

type StaffRow = {
  id: string;
  role: string;
  displayName: string;
  loginName: string;
  email: string;
  createdAt: string;
  disabledAt: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  kitchen: '厨房',
  waiter: '服务员',
  cashier: '收银',
};

export function RestaurantStaffClient({
  restaurantId,
  canManage,
}: {
  restaurantId: string;
  canManage: boolean;
}) {
  const [items, setItems] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDisable, setConfirmDisable] = useState<StaffRow | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch(`/api/ops/restaurants/${restaurantId}/staff`, {
      credentials: 'include',
    });
    if (!res.ok) {
      setError('加载失败');
      setItems([]);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as { items?: StaffRow[] };
    setItems(json.items || []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchStaff = async (staffId: string, action: 'disable' | 'enable') => {
    setActing(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/staff/${staffId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error || '操作失败');
        return;
      }
      await load();
    } finally {
      setActing(false);
      setConfirmDisable(null);
    }
  };

  return (
    <div>
      <p className="text-sm text-zinc-400">
        跨店只读查看员工账号{canManage ? '；admin 可代客停用/启用' : ''}。
      </p>

      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}

      {loading ? (
        <p className="mt-6 text-sm text-zinc-500">加载中…</p>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-zinc-500">暂无员工账号</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-zinc-800">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500">
              <tr>
                <th className="px-3 py-2">显示名</th>
                <th className="px-3 py-2">登录名</th>
                <th className="px-3 py-2">角色</th>
                <th className="px-3 py-2">状态</th>
                {canManage ? <th className="px-3 py-2">操作</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-t border-zinc-800">
                  <td className="px-3 py-2">{row.displayName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.loginName}</td>
                  <td className="px-3 py-2">{ROLE_LABELS[row.role] || row.role}</td>
                  <td className="px-3 py-2">
                    {row.disabledAt ? (
                      <span className="text-red-400">已停用</span>
                    ) : (
                      <span className="text-emerald-400">正常</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2">
                      {row.disabledAt ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void patchStaff(row.id, 'enable')}
                          className="text-amber-400 hover:underline disabled:opacity-50"
                        >
                          启用
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => setConfirmDisable(row)}
                          className="text-red-400 hover:underline disabled:opacity-50"
                        >
                          停用
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDisable}
        onClose={() => setConfirmDisable(null)}
        title="停用员工账号"
        message={
          confirmDisable
            ? `确认停用 ${confirmDisable.displayName}（${confirmDisable.loginName}）？该员工将无法登录。`
            : ''
        }
        confirmLabel="确认停用"
        cancelLabel="取消"
        variant="danger"
        confirming={acting}
        onConfirm={() => {
          if (confirmDisable) void patchStaff(confirmDisable.id, 'disable');
        }}
      />
    </div>
  );
}
