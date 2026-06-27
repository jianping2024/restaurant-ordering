import Link from 'next/link';
import { redirect } from 'next/navigation';
import { OPS_CONSOLE_NAME } from '@mesa/shared';
import { ProductLogo } from '@/components/ui/ProductLogo';
import { getOpsAppUrl } from '@/lib/ops-app-url';

export default function AdminRegisterPage() {
  const opsUrl = getOpsAppUrl();
  if (opsUrl) {
    redirect(`${opsUrl}/ops/login`);
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-card p-8 text-center">
        <ProductLogo href="/" />
        <p className="mt-6 text-sm text-brand-text">
          此页面已下线。新开店请使用 {OPS_CONSOLE_NAME}（<code className="text-xs">/ops</code>）。
        </p>
        <p className="mt-4 text-xs text-brand-text-muted">
          生产环境请配置 <code>NEXT_PUBLIC_OPS_APP_URL</code> 后访问本页将自动跳转到运营登录。
        </p>
        <p className="mt-6 text-sm">
          <Link href="/auth/login" className="text-brand-gold hover:underline">
            店主登录 →
          </Link>
        </p>
      </div>
    </div>
  );
}
