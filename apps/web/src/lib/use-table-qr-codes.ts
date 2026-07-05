'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ensureTableQrCodes,
  generateTableQrDataUrl,
  generateStaffLoginQrDataUrl,
} from '@/lib/table-menu-qr';

export function useTableQrCodes(slug: string, tableIds: string[]) {
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const tableIdKey = useMemo(() => tableIds.join('|'), [tableIds]);

  useEffect(() => {
    let cancelled = false;

    setQrCodes((prev) => {
      const next: Record<string, string> = {};
      for (const tableId of tableIds) {
        if (prev[tableId]) next[tableId] = prev[tableId];
      }
      return next;
    });

    void (async () => {
      await Promise.all(
        tableIds.map(async (tableId) => {
          const dataUrl = await generateTableQrDataUrl(slug, tableId);
          if (cancelled) return;
          setQrCodes((prev) => (prev[tableId] === dataUrl ? prev : { ...prev, [tableId]: dataUrl }));
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [slug, tableIdKey, tableIds]);

  const ensureAll = useCallback(async () => {
    const codes = await ensureTableQrCodes(slug, tableIds);
    setQrCodes((prev) => ({ ...prev, ...codes }));
    return codes;
  }, [slug, tableIds]);

  return { qrCodes, ensureAll };
}

export function useStaffLoginQr(slug: string) {
  const [staffLoginQr, setStaffLoginQr] = useState('');

  useEffect(() => {
    let cancelled = false;
    void generateStaffLoginQrDataUrl(slug).then((dataUrl) => {
      if (!cancelled) setStaffLoginQr(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return staffLoginQr;
}
