'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  isByItemLineExpanded,
  reconcileByItemExpandedLineKey,
  toggleByItemExpandedLineKey,
  type ByItemExpandedLineKey,
} from '@/lib/by-item-line-expansion';

export function useByItemLineExpansion(
  lineSpecs: readonly ByItemLineSpec[],
  byItemAllocations: Record<string, ByItemConsumerRow[]>,
) {
  const [expandedKey, setExpandedKey] = useState<ByItemExpandedLineKey | undefined>(undefined);

  useLayoutEffect(() => {
    setExpandedKey((prev) => reconcileByItemExpandedLineKey(lineSpecs, byItemAllocations, prev));
  }, [lineSpecs, byItemAllocations]);

  const isLineExpanded = useCallback(
    (key: string) => isByItemLineExpanded(key, expandedKey),
    [expandedKey],
  );

  const toggleLineExpanded = useCallback(
    (key: string) => {
      setExpandedKey((prev) => toggleByItemExpandedLineKey(key, prev, lineSpecs, byItemAllocations));
    },
    [lineSpecs, byItemAllocations],
  );

  return {
    expandedKey: expandedKey ?? null,
    isLineExpanded,
    toggleLineExpanded,
  };
}
