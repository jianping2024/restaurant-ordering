'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

export default function OpsBootstrapPage() {
  const router = useRouter();
  const [adminSecret, setAdminSecret] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const res = await fetch('/api/ops/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminSecret, email, password, displayName }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; email?: string };
      if (!res.ok) {
        if (json.error === 'bootstrap_already_done') {
          setError('已有运营账号，请直接登录');
        } else if (json.error === 'invalid_secret') {
          setError('管理员密钥错误');
        } else {
          setError('创建失败，请检查输入');
        }
        return;
      }
      setSuccess(`已创建运营账号 ${json.email}，请登录`);
      setTimeout(() => router.push('/ops/login'), 1500);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6"
      >
        <h1 className="text-xl font-semibold">初始化运营账号</h1>
        <p className="mt-2 text-sm text-zinc-500">
          仅当尚无运营账号时可用。需环境变量 <code className="text-zinc-300">ADMIN_BOOTSTRAP_SECRET</code>。
        </p>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
        {success ? <p className="mt-4 text-sm text-emerald-400">{success}</p> : null}
        <label className="mt-4 block text-sm text-zinc-400">
          管理员密钥
          <input
            type="password"
            required
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-400">
          显示名称
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-400">
          运营邮箱
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <label className="mt-4 block text-sm text-zinc-400">
          初始密码（至少 8 位）
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded bg-amber-500 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {loading ? '创建中…' : '创建首个运营管理员'}
        </button>
        <p className="mt-4 text-center text-sm text-zinc-500">
          已有账号？<Link href="/ops/login" className="text-amber-400 hover:underline">去登录</Link>
        </p>
      </form>
    </div>
  );
}
