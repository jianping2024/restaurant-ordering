import { redirect } from 'next/navigation';
import { DishHistoryManager } from '@/components/dashboard/DishHistoryManager';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { can } from '@/lib/permissions/can';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';
import { getServerLanguage } from '@/lib/i18n.server';
import { getMessages } from '@/lib/i18n/messages';

export default async function DishHistoryPage() {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();

  if (access.mode === 'unauthenticated') redirect('/auth/login');
  if (
    access.mode === 'onboarding' ||
    access.mode === 'access_error' ||
    !loaded ||
    !can(loaded.capabilities, 'dashboard.dish_history.view')
  ) {
    redirect('/dashboard');
  }

  const lang = getServerLanguage();
  const title = getMessages(lang).dishHistory.title;

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl text-brand-gold">{title}</h1>
      <DishHistoryManager restaurantSlug={access.restaurant.slug} />
    </div>
  );
}
