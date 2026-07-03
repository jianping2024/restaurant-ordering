'use client';

import { useCallback, useState } from 'react';
import { resolveByItemLineExpanded } from '@/lib/by-item-line-expanded';

/** UI-only expand/collapse overrides per dish line. */
export function useByItemLineExpanded() {
  const [expandedOverrides, setExpandedOverrides] = useState<Record<string, boolean>>({});

  const isLineExpanded = useCallback(
    (key: string) => resolveByItemLineExpanded(expandedOverrides[key]),
    [expandedOverrides],
  );

  const toggleLineExpanded = useCallback((key: string) => {
    setExpandedOverrides((prev) => ({
      ...prev,
      [key]: !resolveByItemLineExpanded(prev[key]),
    }));
  }, []);

  return { isLineExpanded, toggleLineExpanded };
}
