'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PasswordInput } from '@mesa/ui';

type AdminRow = {
  id: string;
  userId: string;
  email: string | null;
  role: 'support' | 'admin';
  displayName: string;
  disabledAt: string | null;
  createdAt: string;
  isSelf: boolean;
};

export default function AdminsClient() {
  const [items, setItems] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'support' | 'admin'>('support');
  const [creating, setCreating] = useState(false);

  const [confirmDisable, setConfirmDisable] = useState<AdminRow | null>(null);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await fetch('/api/ops/admins', { credentials: 'include' });
    if (!res.ok) {
      setError(res.status === 403 ? '需要 admin 权限' : '加载失败');
      setItems([]);
      setLoading(false);
      return;
    }
    const json = (await res.json()) as { items?: AdminRow[] };
    setItems(json.items || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createAdmin = async (e: FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/ops/admins', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, role }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error || '创建失败');
        return;
      }
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRole('support');
      await load();
    } finally {
      setCreating(false);
    }
  };

  const patchAdmin = async (id: string, body: Record<string, string>) => {
    setActing(true);
    setError('');
    try {
      const res = await fetch(`/api/ops/admins/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      <h1 className="text-2xl font-semibold">运营账号</h1>
      <p className="mt-2 text-sm text-zinc-400">仅 admin 可管理运营人员</p>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <section className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="text-lg font-medium">新建账号</h2>
        <form onSubmit={createAdmin} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm text-zinc-400 sm:col-span-2">
            邮箱
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <PasswordInput
            variant="zinc"
            label="初始密码（至少 8 位）"
            labelClassName="block text-sm text-zinc-400"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 pr-10"
          />
          <label className="block text-sm text-zinc-400">
            显示名称
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            />
          </label>
          <label className="block text-sm text-zinc-400">
            角色
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'support' | 'admin')}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="support">support（只读 + 重置密码 + 吊销打印）</option>
              <option value="admin">admin（完整治理权限）</option>
            </select>
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {creating ? '创建中…' : '创建'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-medium">现有账号</h2>
        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">加载中…</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-800">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-900 text-zinc-500">
                <tr>
                  <th className="px-3 py-2">邮箱</th>
                  <th className="px-3 py-2">名称</th>
                  <th className="px-3 py-2">角色</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className="border-t border-zinc-800">
                    <td className="px-3 py-2">{row.email || '—'}</td>
                    <td className="px-3 py-2">{row.displayName}</td>
                    <td className="px-3 py-2">
                      {row.isSelf ? (
                        <span>{row.role}</span>
                      ) : (
                        <select
                          value={row.role}
                          disabled={acting || !!row.disabledAt}
                          onChange={(e) =>
                            void patchAdmin(row.id, { role: e.target.value })
                          }
                          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
                        >
                          <option value="support">support</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.disabledAt ? (
                        <span className="text-red-400">已停用</span>
                      ) : (
                        <span className="text-emerald-400">正常</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.isSelf ? (
                        <span className="text-zinc-500">当前账号</span>
                      ) : row.disabledAt ? (
                        <button
                          type="button"
                          disabled={acting}
                          onClick={() => void patchAdmin(row.id, { action: 'enable' })}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmModal
        open={!!confirmDisable}
        onClose={() => setConfirmDisable(null)}
        title="停用运营账号"
        message={
          confirmDisable
            ? `确认停用 ${confirmDisable.email || confirmDisable.displayName}？该账号将无法再登录运营后台。`
            : ''
        }
        confirmLabel="确认停用"
        cancelLabel="取消"
        variant="danger"
        confirming={acting}
        onConfirm={() => {
          if (confirmDisable) void patchAdmin(confirmDisable.id, { action: 'disable' });
        }}
      />
    </div>
  );
}
