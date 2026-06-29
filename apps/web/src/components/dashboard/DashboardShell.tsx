'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DASHBOARD_NAV_COLLAPSED_STORAGE_KEY,
  dashboardMainOffsetClass,
} from '@/lib/dashboard-nav-layout';

type DashboardNavLayoutContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const DashboardNavLayoutContext = createContext<DashboardNavLayoutContextValue | null>(null);

export function useDashboardNavLayout(): DashboardNavLayoutContextValue {
  const ctx = useContext(DashboardNavLayoutContext);
  if (!ctx) {
    throw new Error('useDashboardNavLayout must be used within DashboardShell');
  }
  return ctx;
}

function usePersistedNavCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(DASHBOARD_NAV_COLLAPSED_STORAGE_KEY) === '1');
    } catch {
      // ignore storage errors
    }
    setReady(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DASHBOARD_NAV_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  return { collapsed: ready ? collapsed : false, toggleCollapsed };
}

export function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const { collapsed, toggleCollapsed } = usePersistedNavCollapse();
  const value = useMemo(
    () => ({ collapsed, toggleCollapsed }),
    [collapsed, toggleCollapsed],
  );

  return (
    <DashboardNavLayoutContext.Provider value={value}>
      <div className="min-h-screen bg-brand-bg flex">
        {sidebar}
        <main
          className={`flex-1 min-w-0 overflow-x-hidden p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8 lg:pt-8 min-h-screen transition-[margin-left] duration-200 ease-out motion-reduce:transition-none ${dashboardMainOffsetClass(collapsed)}`}
        >
          {children}
        </main>
      </div>
    </DashboardNavLayoutContext.Provider>
  );
}
