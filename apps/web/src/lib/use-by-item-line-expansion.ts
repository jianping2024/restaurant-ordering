'use client';

import { useCallback, useLayoutEffect, useState } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  isByItemLineExpanded,
  seedInitialLineExpansion,
  toggleByItemLineExpansion,
  type ByItemLineExpansionState,
} from '@/lib/by-item-line-expansion';

export function useByItemLineExpansion(
  lineSpecs: readonly ByItemLineSpec[],
  byItemAllocations: Record<string, ByItemConsumerRow[]>,
) {
  const [expanded, setExpanded] = useState<ByItemLineExpansionState>({});

  // Initialize from line list only — allocation edits must not drive expand/collapse.
  useLayoutEffect(() => {
    setExpanded((prev) => seedInitialLineExpansion(lineSpecs, byItemAllocations, prev));
    // byItemAllocations intentionally omitted: only read for first paint when lineSpecs arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  }, [lineSpecs]);

  const isLineExpanded = useCallback(
    (key: string) => isByItemLineExpanded(key, expanded),
    [expanded],
  );

  const toggleLineExpanded = useCallback(
    (key: string) => {
      setExpanded((prev) => toggleByItemLineExpansion(key, prev, lineSpecs, byItemAllocations));
    },
    [lineSpecs, byItemAllocations],
  );

  return { isLineExpanded, toggleLineExpanded };
}
