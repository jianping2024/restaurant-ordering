import { parseProFeatureProduct, type ProFeatureProduct } from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProSettingsClient } from './ProSettingsClient';

export default async function ProSettingsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('pro_feature_products')
    .select('feature_key, price_month_eur, price_year_eur, active')
    .order('feature_key');

  const products = (data ?? [])
    .map((row) => parseProFeatureProduct(row))
    .filter((p): p is ProFeatureProduct => p != null);

  return (
    <div>
      <h1 className="text-xl font-semibold">Pro 功能定价</h1>
      <p className="mt-1 text-sm text-zinc-500">
        维护每项 Pro 功能的月价/年价（欧元）。每店开通范围在餐厅详情里勾选。
      </p>
      <div className="mt-6 max-w-3xl">
        <ProSettingsClient initial={{ products }} />
      </div>
    </div>
  );
}
