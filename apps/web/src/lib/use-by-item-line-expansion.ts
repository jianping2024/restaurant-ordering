'use client';

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
} from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  isByItemExpandedLineComplete,
  isByItemExpansionHoldTarget,
  isByItemLineExpanded,
  reconcileByItemExpandedLineKey,
  toggleByItemExpandedLineKey,
  type ByItemExpandedLineKey,
} from '@/lib/by-item-line-expansion';
import { SOFT_KEYBOARD_DISMISS_ARM_MS } from '@/lib/soft-keyboard-viewport';

export function useByItemLineExpansion(
  lineSpecs: readonly ByItemLineSpec[],
  byItemAllocations: Record<string, ByItemConsumerRow[]>,
) {
  const [expandedKey, setExpandedKey] = useState<ByItemExpandedLineKey | undefined>(undefined);
  const [holdWhileEditing, setHoldWhileEditing] = useState(false);
  const holdClearTimerRef = useRef<number | null>(null);
  const expandedKeyRef = useRef<ByItemExpandedLineKey | undefined>(expandedKey);
  const lineSpecsRef = useRef(lineSpecs);
  const allocationsRef = useRef(byItemAllocations);
  expandedKeyRef.current = expandedKey;
  lineSpecsRef.current = lineSpecs;
  allocationsRef.current = byItemAllocations;

  const clearHoldClearTimer = useCallback(() => {
    if (holdClearTimerRef.current != null) {
      window.clearTimeout(holdClearTimerRef.current);
      holdClearTimerRef.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    setExpandedKey((prev) =>
      reconcileByItemExpandedLineKey(lineSpecs, byItemAllocations, prev, {
        holdWhileEditing,
      }),
    );
  }, [lineSpecs, byItemAllocations, holdWhileEditing]);

  useLayoutEffect(() => () => clearHoldClearTimer(), [clearHoldClearTimer]);

  const isLineExpanded = useCallback(
    (key: string) => isByItemLineExpanded(key, expandedKey),
    [expandedKey],
  );

  const toggleLineExpanded = useCallback(
    (key: string) => {
      clearHoldClearTimer();
      setHoldWhileEditing(false);
      setExpandedKey((prev) =>
        toggleByItemExpandedLineKey(key, prev, lineSpecs, byItemAllocations),
      );
    },
    [lineSpecs, byItemAllocations, clearHoldClearTimer],
  );

  const onExpandedCardFocusIn = useCallback(
    (event: FocusEvent) => {
      const key = expandedKeyRef.current;
      if (typeof key !== 'string') return;
      if (!isByItemExpansionHoldTarget(event.target, key)) return;
      clearHoldClearTimer();
      setHoldWhileEditing(true);
    },
    [clearHoldClearTimer],
  );

  const onExpandedCardFocusOut = useCallback(
    (event: FocusEvent) => {
      const key = expandedKeyRef.current;
      if (typeof key !== 'string') return;
      if (!isByItemExpansionHoldTarget(event.target, key)) return;
      // Still moving within the open card or the portaled name rail → keep hold.
      if (isByItemExpansionHoldTarget(event.relatedTarget, key)) return;
      clearHoldClearTimer();

      // Leaving a completed line with a known relatedTarget: clear hold now so
      // advance + focus-next-name can run close to the blur (helps iOS keyboard).
      if (
        event.relatedTarget != null
        && isByItemExpandedLineComplete(key, lineSpecsRef.current, allocationsRef.current)
      ) {
        setHoldWhileEditing(false);
        return;
      }

      // iOS often nulls relatedTarget; arm then re-check activeElement.
      holdClearTimerRef.current = window.setTimeout(() => {
        holdClearTimerRef.current = null;
        const openKey = expandedKeyRef.current;
        if (typeof openKey !== 'string') {
          setHoldWhileEditing(false);
          return;
        }
        if (isByItemExpansionHoldTarget(document.activeElement, openKey)) {
          setHoldWhileEditing(true);
          return;
        }
        setHoldWhileEditing(false);
      }, SOFT_KEYBOARD_DISMISS_ARM_MS);
    },
    [clearHoldClearTimer],
  );

  return {
    expandedKey: expandedKey ?? null,
    holdWhileEditing,
    isLineExpanded,
    toggleLineExpanded,
    onExpandedCardFocusIn,
    onExpandedCardFocusOut,
  };
}
