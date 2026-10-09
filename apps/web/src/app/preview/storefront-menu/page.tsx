import { CustomerStorefrontMenuPreview } from '@/components/menu/CustomerStorefrontMenuPreview';
import { buildCustomerStorefrontPreviewModel } from '@/lib/customer-storefront-preview-model';

export const metadata = {
  title: 'Storefront menu preview',
  robots: { index: false, follow: false },
};

/** Static visual only — real menu chrome + mock storefront band. */
export default function PreviewStorefrontMenuPage() {
  const model = buildCustomerStorefrontPreviewModel();
  return <CustomerStorefrontMenuPreview model={model} />;
}
