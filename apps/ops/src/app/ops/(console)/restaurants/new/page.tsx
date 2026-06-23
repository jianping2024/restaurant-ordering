'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import type { PrintLocale } from '@mesa/shared';

export default function NewRestaurantPage() {
  const router = useRouter();
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [printLocale, setPrintLocale] = useState<PrintLocale>('pt');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/ops/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          restaurantName,
          email,
          password,
          printLocale,
          slug: slug.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { error?: string; restaurantId?: string };
      if (!res.ok) {
        setError(json.error || '创建失败');
        return;
      }
      router.push(`/ops/restaurants/${json.restaurantId}`);
      router.refresh();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <Link href="/ops/restaurants" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← 返回列表
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">创建餐厅 + 店主</h1>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm text-zinc-400">
          餐厅名称
          <input
            required
            value={restaurantName}
            onChange={(e) => setRestaurantName(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          店主邮箱
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          初始密码（至少 6 位）
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        <label className="block text-sm text-zinc-400">
          打印语言
          <select
            value={printLocale}
            onChange={(e) => setPrintLocale(e.target.value as PrintLocale)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            <option value="pt">pt</option>
            <option value="zh">zh</option>
            <option value="en">en</option>
          </select>
        </label>
        <label className="block text-sm text-zinc-400">
          slug（可选，留空自动生成）
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-60"
        >
          {loading ? '创建中…' : '创建'}
        </button>
      </form>
    </div>
  );
}
