import { redirect } from 'next/navigation';
import { GuestNoticeManager } from '@/components/dashboard/GuestNoticeManager';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { requireDashboardStore } from '@/lib/dashboard-access-cached';
import { dashboardStoreHref } from '@/lib/dashboard-store-routes';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadGuestOrderingNotice } from '@/lib/guest-ordering-notice-server';
import { NAV_PERMISSION } from '@/lib/permissions/registry';

export default async function GuestNoticeSettingsPage({ params }: { params: { slug: string } }) {
  const access = await requireDashboardStore(params.slug);
  const storeHome = dashboardStoreHref(access.restaurant.slug);
  const gate = resolveDashboardCapabilityAccess(
    access,
    access.loaded.capabilities,
    NAV_PERMISSION.guestNotice,
  );
  if (!gate.ok) redirect(storeHome);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect(storeHome);
  }

  const notice = await loadGuestOrderingNotice(admin, gate.restaurantId);

  return <GuestNoticeManager initialNotice={notice} />;
}
