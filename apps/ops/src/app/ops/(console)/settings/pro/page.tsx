import { normalizePremiumKeys } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProSettingsClient } from './ProSettingsClient';

export default async function ProSettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('platform_pro_settings')
    .select('premium_keys, wechat_url, whatsapp_url')
    .eq('id', 'default')
    .maybeSingle();

  return (
    <div>
      <h1 className="text-xl font-semibold">Pro 会员设置</h1>
      <p className="mt-1 text-sm text-zinc-500">
        全局配置哪些功能需要 Pro，以及租户升级页的联系链接。
      </p>
      <div className="mt-6 max-w-lg rounded-lg border border-zinc-800 bg-zinc-900 p-5">
        <ProSettingsClient
          initial={{
            premiumKeys: normalizePremiumKeys(data?.premium_keys),
            wechatUrl: data?.wechat_url ?? null,
            whatsappUrl: data?.whatsapp_url ?? null,
          }}
        />
      </div>
    </div>
  );
}
