import type { ComponentType } from 'react';
import { PreviewBillContent } from '@/components/landing/preview/PreviewBillScreen';
import { PreviewDashboardContent } from '@/components/landing/preview/PreviewDashboardScreen';
import { PreviewKitchenContent } from '@/components/landing/preview/PreviewKitchenScreen';
import { PreviewMenuContent } from '@/components/landing/preview/PreviewMenuScreen';
import { PreviewWaiterOpenContent } from '@/components/landing/preview/PreviewWaiterOpenScreen';

export const LANDING_PREVIEW_SCREEN_IDS = [
  'waiter-open',
  'menu',
  'kitchen',
  'bill',
  'dashboard',
] as const;

export type LandingPreviewScreenId = (typeof LANDING_PREVIEW_SCREEN_IDS)[number];

export type LandingPreviewScreenMeta = {
  id: LandingPreviewScreenId;
  route: `/preview/${LandingPreviewScreenId}`;
  captureFile: `${LandingPreviewScreenId}.png`;
};

export const LANDING_PREVIEW_SCREEN_META: readonly LandingPreviewScreenMeta[] = [
  { id: 'waiter-open', route: '/preview/waiter-open', captureFile: 'waiter-open.png' },
  { id: 'menu', route: '/preview/menu', captureFile: 'menu.png' },
  { id: 'kitchen', route: '/preview/kitchen', captureFile: 'kitchen.png' },
  { id: 'bill', route: '/preview/bill', captureFile: 'bill.png' },
  { id: 'dashboard', route: '/preview/dashboard', captureFile: 'dashboard.png' },
];

export const LANDING_PREVIEW_COMPONENTS: Record<
  LandingPreviewScreenId,
  ComponentType<{ showLabel?: boolean }>
> = {
  'waiter-open': PreviewWaiterOpenContent,
  menu: PreviewMenuContent,
  kitchen: PreviewKitchenContent,
  bill: PreviewBillContent,
  dashboard: PreviewDashboardContent,
};