'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

function OpsLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/ops';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/ops/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          json.error === 'not_platform_admin'
            ? '该账号不是平台运营账号'
            : '邮箱或密码错误',
        );
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6"
    >
      <h1 className="text-xl font-semibold text-white">Mesa 运营登录</h1>
      <p className="mt-1 text-sm text-zinc-500">平台内部账号，与店主后台分离</p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      <label className="mt-6 block text-sm text-zinc-400">
        邮箱
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
        />
      </label>
      <label className="mt-4 block text-sm text-zinc-400">
        密码
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded bg-amber-500 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400 disabled:opacity-60"
      >
        {loading ? '登录中…' : '登录'}
      </button>
    </form>
  );
}

export default function OpsLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <Suspense fallback={<div className="text-zinc-500">加载中…</div>}>
        <OpsLoginForm />
      </Suspense>
    </div>
  );
}
