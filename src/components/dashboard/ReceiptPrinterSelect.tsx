'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { fetchReceiptPrinters } from '@/lib/fetch-receipt-printers';
import { getMessages } from '@/lib/i18n/messages';
import type { ReceiptPrinterOption } from '@/lib/print-receipt-printer-options';

type Props = {
  restaurantSlug: string;
  value: string;
  onChange: (printerId: string) => void;
  className?: string;
  labelClassName?: string;
};

export function ReceiptPrinterSelect({
  restaurantSlug,
  value,
  onChange,
  className,
  labelClassName = 'text-[13px] text-brand-text-muted block mb-1.5',
}: Props) {
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const [printers, setPrinters] = useState<ReceiptPrinterOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchReceiptPrinters({ slug: restaurantSlug, lang }).then((res) => {
      if (cancelled) return;
      setPrinters(res.printers);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, lang]);

  const printerLabel = (p: ReceiptPrinterOption) =>
    p.id === 'cashier' ? `${t.receiptPrinterCashier}（${t.receiptPrinter}）` : p.label;

  const selectedLabel = value ? printers.find((p) => p.id === value) : undefined;
  const selectedLabelText = selectedLabel ? printerLabel(selectedLabel) : undefined;
  const currentStatus = !loading
    ? value && selectedLabelText
      ? t.receiptPrinterCurrent.replace('{label}', selectedLabelText)
      : value
        ? t.receiptPrinterCurrent.replace('{label}', value)
        : t.receiptPrinterCurrentNone
    : null;

  return (
    <div className={className}>
      <label className={labelClassName}>{t.receiptPrinter}</label>
      {loading ? (
        <p className="text-sm text-brand-text-muted">{t.receiptPrintersLoading}</p>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
          >
            <option value="">{t.receiptPrinterNone}</option>
            {printers.map((p) => (
              <option key={p.id} value={p.id}>
                {printerLabel(p)}
              </option>
            ))}
          </select>
          {currentStatus ? (
            <p
              className={`text-[12px] mt-1.5 leading-snug ${value ? 'text-brand-gold/90' : 'text-brand-text-muted'}`}
              aria-live="polite"
            >
              {currentStatus}
            </p>
          ) : null}
        </>
      )}
      {!loading && printers.length === 0 ? (
        <p className="text-[12px] text-brand-text-muted mt-1.5 leading-snug">{t.receiptPrintersEmpty}</p>
      ) : null}
    </div>
  );
}
