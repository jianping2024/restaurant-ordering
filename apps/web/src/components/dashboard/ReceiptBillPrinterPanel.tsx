'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { ReceiptPrinterSelect } from '@/components/dashboard/ReceiptPrinterSelect';
import { getMessages } from '@/lib/i18n/messages';
import type { ReceiptPrinterOption } from '@/lib/print-receipt-printer-options';

type Props = {
  restaurantSlug: string;
  initialDefaultReceiptStationId?: string;
  initialPrinters?: ReceiptPrinterOption[];
};

export function ReceiptBillPrinterPanel({
  restaurantSlug,
  initialDefaultReceiptStationId = '',
  initialPrinters = [],
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).printAssistant.billReceipt;
  const [printerId, setPrinterId] = useState(initialDefaultReceiptStationId);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrinterId(initialDefaultReceiptStationId);
  }, [initialDefaultReceiptStationId]);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/print-agent/bill-receipt-printer', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          default_receipt_station_id: printerId || null,
        }),
      });
      const data = (await res.json()) as {
        default_receipt_station_id?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'save_failed');
        return;
      }
      setPrinterId(data.default_receipt_station_id || '');
      setSaved(true);
    } catch {
      setError('network');
    } finally {
      setSaving(false);
    }
  }, [printerId]);

  return (
    <section className="bg-brand-card border border-brand-border rounded-xl px-5 py-5 shadow-sm">
      <h2 className="font-heading text-xl text-brand-text">{t.title}</h2>
      <p className="text-brand-text-muted text-sm mt-2 leading-relaxed">{t.subtitle}</p>
      <p className="text-brand-text-muted text-[13px] mt-3 leading-relaxed">{t.mappingHint}</p>
      <div className="mt-4 max-w-md">
        <ReceiptPrinterSelect
          restaurantSlug={restaurantSlug}
          value={printerId}
          initialPrinters={initialPrinters}
          onChange={(id) => {
            setPrinterId(id);
            setSaved(false);
          }}
          labelClassName="text-[13px] text-brand-text-muted block mb-1.5"
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={() => void save()} loading={saving}>
          {t.save}
        </Button>
        {saved ? <span className="text-sm text-emerald-500">{t.saved}</span> : null}
        {error ? (
          <span className="text-sm text-red-500">
            {t.errorPrefix}
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
