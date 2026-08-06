'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

/**
 * On-prem install claim UI — sole page for install code + owner password.
 * Success → /auth/login only (no auto-login).
 */
export default function SetupClaimPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/setup/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          ownerPassword,
          ...(platformUrl.trim() ? { platformUrl: platformUrl.trim() } : {}),
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        detail?: string;
        redirectTo?: string;
        ownerEmail?: string;
      };
      if (!res.ok) {
        setError(json.detail ? `${json.error}: ${json.detail}` : json.error || '认领失败');
        return;
      }
      const login = json.redirectTo || '/auth/login';
      const q = json.ownerEmail ? `?email=${encodeURIComponent(json.ownerEmail)}` : '';
      router.replace(`${login}${q}`);
    } catch {
      setError('网络错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-brand-text">门店认领</h1>
          <p className="mt-2 text-sm text-brand-muted">
            输入云 Ops 签发的安装码，并设置本机店主密码。完成后请自行登录，不会自动登录。若本机已认领过，可用新安装码重新绑定授权并重设店主密码。
          </p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="text-brand-muted">安装码</span>
            <Input
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-brand-muted">店主密码（本机账号）</span>
            <Input
              required
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              minLength={6}
              autoComplete="new-password"
              className="mt-1"
            />
          </label>
          <label className="block text-sm">
            <span className="text-brand-muted">平台 Ops 地址（可选，未配置环境变量时必填）</span>
            <Input
              value={platformUrl}
              onChange={(e) => setPlatformUrl(e.target.value)}
              placeholder="https://ops.example.com 或 http://127.0.0.1:3001"
              className="mt-1"
            />
          </label>
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '认领中…' : '认领并前往登录'}
          </Button>
        </form>
        <p className="text-sm text-brand-muted">
          已认领？{' '}
          <Link href="/auth/login" className="text-brand-text underline">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
