'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  dashboardStoreHref,
  restaurantApiPath,
  type DashboardPagePath,
} from '@/lib/dashboard-store-routes';

export type DashboardStore = {
  restaurantId: string;
  slug: string;
  /** Store page href (`/dashboard/r/{slug}{page}`). */
  href: (page?: DashboardPagePath) => string;
  /** Store API URL (`/api/restaurants/{slug}{path}`). */
  api: (path: string) => string;
};

const DashboardStoreContext = createContext<DashboardStore | null>(null);

/** Sole client source of the current store (from the `/dashboard/r/[slug]` layout). */
export function DashboardStoreProvider({
  restaurantId,
  slug,
  children,
}: {
  restaurantId: string;
  slug: string;
  children: ReactNode;
}) {
  const value = useMemo<DashboardStore>(
    () => ({
      restaurantId,
      slug,
      href: (page = '') => dashboardStoreHref(slug, page),
      api: (path) => restaurantApiPath(slug, path),
    }),
    [restaurantId, slug],
  );
  return <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>;
}

export function useDashboardStore(): DashboardStore {
  const store = useContext(DashboardStoreContext);
  if (!store) throw new Error('useDashboardStore outside /dashboard/r/[slug]');
  return store;
}
