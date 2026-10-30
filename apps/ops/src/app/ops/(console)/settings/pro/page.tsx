import {
  parseProFeatureProduct,
  parseSubscriptionBaseProduct,
  type ProFeatureProduct,
} from '@mesa/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { ProSettingsClient } from './ProSettingsClient';

export default async function ProSettingsPage() {
  const admin = createAdminClient();
  const [{ data: productRows }, { data: baseRow }] = await Promise.all([
    admin
      .from('pro_feature_products')
      .select('feature_key, price_month_eur, price_year_eur, active')
      .order('feature_key'),
    admin
      .from('subscription_base_product')
      .select('price_month_eur, price_year_eur')
      .eq('id', 'default')
      .maybeSingle(),
  ]);

  const products = (productRows ?? [])
    .map((row) => parseProFeatureProduct(row))
    .filter((p): p is ProFeatureProduct => p != null);
  const base = parseSubscriptionBaseProduct(baseRow) ?? { priceMonthEur: 0, priceYearEur: 0 };

  return (
    <div>
      <h1 className="text-xl font-semibold">订阅定价</h1>
      <p className="mt-1 text-sm text-zinc-500">
        维护基础版与 Pro 功能的月价/年价（欧元）。每店报价 = 基础 + 已勾 Pro 功能；开通范围在餐厅详情勾选。
      </p>
      <div className="mt-6 max-w-3xl">
        <ProSettingsClient initial={{ base, products }} />
      </div>
    </div>
  );
}
