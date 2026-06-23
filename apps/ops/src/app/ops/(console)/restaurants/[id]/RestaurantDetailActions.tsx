'use client';

import { useState } from 'react';

export function RestaurantDetailActions({ restaurantId }: { restaurantId: string }) {
  const [password, setPassword] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const resetPassword = async (useRandom: boolean) => {
    setError('');
    setResult('');
    setLoading(true);
    try {
      const res = await fetch(`/api/ops/restaurants/${restaurantId}/reset-owner-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password: useRandom ? undefined : password,
          forceChange: true,
        }),
      });
      const json = (await res.json()) as { error?: string; temporaryPassword?: string };
      if (!res.ok) {
        setError(json.error || '重置失败');
        return;
      }
      setResult(json.temporaryPassword || '已更新');
      if (useRandom) setPassword('');
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="text-lg font-medium">重置店主密码</h2>
      <p className="mt-1 text-sm text-zinc-500">操作会写入审计日志</p>
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      {result ? (
        <p className="mt-3 text-sm text-emerald-400">
          新密码：<code className="rounded bg-zinc-950 px-1">{result}</code>（请安全传达给店主）
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="指定密码（至少 6 位）"
          className="min-w-[200px] flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={loading || password.length < 6}
          onClick={() => void resetPassword(false)}
          className="rounded border border-zinc-600 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
        >
          设为指定密码
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void resetPassword(true)}
          className="rounded bg-amber-500 px-3 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          生成随机密码
        </button>
      </div>
    </section>
  );
}
