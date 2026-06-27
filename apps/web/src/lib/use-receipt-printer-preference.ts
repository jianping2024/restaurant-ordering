'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadSavedReceiptPrinterId,
  saveReceiptPrinterId,
} from '@/lib/receipt-printer-preference';

type Options = {
  /** When false, skip loading/saving (e.g. non-checkout surfaces). */
  enabled?: boolean;
};

/**
 * Per-restaurant receipt printer choice for checkout flows.
 * Persists in localStorage so frontdesk/waiter devices remember the last picker value.
 */
export function useReceiptPrinterPreference(
  restaurantSlug: string | undefined,
  options: Options = {},
) {
  const enabled = options.enabled ?? Boolean(restaurantSlug);

  const [printerId, setPrinterIdState] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!restaurantSlug || !enabled) {
      setPrinterIdState('');
      setSettingsOpen(false);
      return;
    }
    const saved = loadSavedReceiptPrinterId(restaurantSlug);
    setPrinterIdState(saved);
    setSettingsOpen(!saved);
  }, [restaurantSlug, enabled]);

  const setPrinterId = useCallback(
    (id: string) => {
      setPrinterIdState(id);
      setSettingsOpen(!id);
      if (restaurantSlug && enabled) {
        saveReceiptPrinterId(restaurantSlug, id);
      }
    },
    [restaurantSlug, enabled],
  );

  return {
    printerId,
    setPrinterId,
    settingsOpen,
    setSettingsOpen,
  };
}
