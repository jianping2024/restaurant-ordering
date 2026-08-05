import type { ComponentType } from 'react';
import { PreviewBarContent } from '@/components/landing/preview/PreviewBarScreen';
import { PreviewDashboardContent } from '@/components/landing/preview/PreviewDashboardScreen';
import { PreviewMenuContent } from '@/components/landing/preview/PreviewMenuScreen';
import { PreviewWaiterOpenContent } from '@/components/landing/preview/PreviewWaiterOpenScreen';

/** Homepage product-preview tabs — no split-bill intro. */
export const LANDING_PREVIEW_SCREEN_IDS = [
  'waiter-open',
  'menu',
  'bar',
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
  { id: 'bar', route: '/preview/bar', captureFile: 'bar.png' },
  { id: 'dashboard', route: '/preview/dashboard', captureFile: 'dashboard.png' },
];

export const LANDING_PREVIEW_COMPONENTS: Record<
  LandingPreviewScreenId,
  ComponentType<{ showLabel?: boolean }>
> = {
  'waiter-open': PreviewWaiterOpenContent,
  menu: PreviewMenuContent,
  bar: PreviewBarContent,
  dashboard: PreviewDashboardContent,
};
