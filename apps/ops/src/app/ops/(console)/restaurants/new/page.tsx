'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import {
  RESTAURANT_COUNTRY_OPTIONS,
  todayLisbonCalendarDate,
  type DeploymentMode,
  type PrintLocale,
  type RestaurantCountryCode,
} from '@mesa/shared';
import { PasswordInput } from '@mesa/ui';

export default function NewRestaurantPage() {
  const router = useRouter();
  const [deploymentMode, setDeploymentMode] = useState<DeploymentMode>('cloud');
  const [restaurantName, setRestaurantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [printLocale, setPrintLocale] = useState<PrintLocale>('pt');
  const [countryCode, setCountryCode] = useState<RestaurantCountryCode>('PT');
  const [slug, setSlug] = useState('');
  const [licenseValidUntil, setLicenseValidUntil] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const minLicenseDate = todayLisbonCalendarDate();

  const onPrem = deploymentMode === 'on_prem';

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
          deploymentMode,
          restaurantName,
          email,
          password: onPrem ? undefined : password,
          printLocale,
          countryCode,
          slug: slug.trim() || undefined,
          // Lisbon calendar day only; server normalizes to Europe/Lisbon EOD.
          licenseValidUntil: onPrem && licenseValidUntil ? licenseValidUntil : undefined,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        restaurantId?: string;
        deploymentMode?: string;
      };
      if (!res.ok) {
        setError(json.error || '创建失败');
        return;
      }
      if (json.deploymentMode === 'on_prem' && json.restaurantId) {
        router.push(`/ops/licenses/${json.restaurantId}`);
      } else {
        router.push(`/ops/restaurants/${json.restaurantId}`);
      }
      router.refresh();
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg">
      <Link href="/ops" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← 返回列表
      </Link>
      <h1 className="mt-4 text-2xl font-semibold">{onPrem ? '登记本地门店' : '创建云餐厅 + 店主'}</h1>
      <p className="mt-2 text-sm text-zinc-500">
        {onPrem
          ? '只在平台登记控制面档案，不创建云 Auth 店主。装机后用安装码认领。'
          : '在云营业库创建餐厅并开通店主账号。'}
      </p>
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm text-zinc-400">交付方式</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={deploymentMode === 'cloud'}
              onChange={() => setDeploymentMode('cloud')}
            />
            云（SaaS）
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="mode"
              checked={deploymentMode === 'on_prem'}
              onChange={() => setDeploymentMode('on_prem')}
            />
            本地安装（on-prem）
          </label>
        </fieldset>
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
          {onPrem ? '店主邮箱（认领时创建本机账号）' : '店主邮箱'}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>
        {!onPrem ? (
          <PasswordInput
            variant="zinc"
            label="初始密码（至少 6 位）"
            labelClassName="block text-sm text-zinc-400"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            inputClassName="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10"
          />
        ) : (
          <>
            <label className="block text-sm text-zinc-400">
              初始授权截止日（可选，里斯本日历日 · 当日 23:59:59 过期）
              <input
                type="date"
                value={licenseValidUntil}
                min={minLicenseDate}
                onChange={(e) => setLicenseValidUntil(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 [color-scheme:dark]"
              />
            </label>
          </>
        )}
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
          国家/地区
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value as RestaurantCountryCode)}
            className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {RESTAURANT_COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
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
          {loading ? '提交中…' : onPrem ? '登记并前往授权' : '创建'}
        </button>
      </form>
    </div>
  );
}
