import { redirect } from 'next/navigation';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';

/** Legacy URL — print stations live under menu management. */
export default function SettingsPrintStationsPage({ params }: { params: { slug: string } }) {
  redirect(dashboardStoreHref(params.slug, '/menu'));
}
