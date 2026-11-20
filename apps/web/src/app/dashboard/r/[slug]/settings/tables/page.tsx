import { redirect } from 'next/navigation';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';

export default function SettingsTablesPageRedirect({ params }: { params: { slug: string } }) {
  redirect(dashboardStoreHref(params.slug, '/tables'));
}
