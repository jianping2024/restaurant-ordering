import type { ReceiptPrinterOption } from '@/lib/print-receipt-printer-options';
import type { Language } from '@/types';

export async function fetchReceiptPrinters(params: {
  slug: string;
  lang: Language;
}): Promise<{ printers: ReceiptPrinterOption[]; updated_at: string | null }> {
  const qs = new URLSearchParams({
    slug: params.slug,
    lang: params.lang,
  });
  const res = await fetch(`/api/print-agent/receipt-printers?${qs}`, { credentials: 'include' });
  if (!res.ok) {
    return { printers: [], updated_at: null };
  }
  const data = (await res.json()) as {
    printers?: ReceiptPrinterOption[];
    updated_at?: string | null;
  };
  return {
    printers: data.printers || [],
    updated_at: data.updated_at ?? null,
  };
}
