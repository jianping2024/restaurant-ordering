import { notFound } from 'next/navigation';
import { GuestNoticeManager } from '@/components/dashboard/GuestNoticeManager';
import { loadMenuManagementContext } from '@/lib/dashboard-access';
import { loadGuestOrderingNotice } from '@/lib/guest-ordering-notice-server';

export default async function GuestNoticeSettingsPage() {
  const ctx = await loadMenuManagementContext();
  if ('error' in ctx) {
    notFound();
  }

  const notice = await loadGuestOrderingNotice(ctx.admin, ctx.restaurantId);

  return <GuestNoticeManager initialNotice={notice} />;
}
