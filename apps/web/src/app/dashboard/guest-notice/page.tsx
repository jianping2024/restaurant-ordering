import { notFound } from 'next/navigation';
import { GuestNoticeManager } from '@/components/dashboard/GuestNoticeManager';
import { getDashboardOperationalContext } from '@/lib/dashboard-access-cached';
import { loadGuestOrderingNotice } from '@/lib/guest-ordering-notice-server';

export default async function GuestNoticeSettingsPage() {
  const ctx = await getDashboardOperationalContext();
  if ('error' in ctx) {
    notFound();
  }

  const notice = await loadGuestOrderingNotice(ctx.admin, ctx.restaurantId);

  return <GuestNoticeManager initialNotice={notice} />;
}
