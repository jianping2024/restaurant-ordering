import { redirect } from 'next/navigation';
import { GuestNoticeManager } from '@/components/dashboard/GuestNoticeManager';
import { resolveDashboardCapabilityAccess } from '@/lib/dashboard-capability-access';
import { getDashboardAccess } from '@/lib/dashboard-access-cached';
import { createAdminClient } from '@/lib/supabase/admin';
import { loadGuestOrderingNotice } from '@/lib/guest-ordering-notice-server';
import { NAV_PERMISSION } from '@/lib/permissions/registry';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export default async function GuestNoticeSettingsPage() {
  const access = await getDashboardAccess();
  const loaded = await loadPrincipalWithCapabilities();
  const gate = resolveDashboardCapabilityAccess(
    access,
    loaded?.capabilities ?? null,
    NAV_PERMISSION.guestNotice,
  );
  if (!gate.ok) {
    if (gate.status === 401) redirect('/auth/login');
    redirect('/dashboard');
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    redirect('/dashboard');
  }

  const notice = await loadGuestOrderingNotice(admin, gate.restaurantId);

  return <GuestNoticeManager initialNotice={notice} />;
}
