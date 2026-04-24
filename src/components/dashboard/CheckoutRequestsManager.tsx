'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages, UI_LOCALE_BY_LANG } from '@/lib/i18n/messages';
import type { BillSplit } from '@/types';

interface Props {
  initialRequests: BillSplit[];
}

export function CheckoutRequestsManager({ initialRequests }: Props) {
  const [requests, setRequests] = useState<BillSplit[]>(initialRequests);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { lang } = useLanguage();
  const t = getMessages(lang).checkout;
  const locale = UI_LOCALE_BY_LANG[lang];

  const handleConfirmPaid = async (request: BillSplit) => {
    setProcessingId(request.id);
    const supabase = createClient();

    try {
      const { error: billError } = await supabase
        .from('bill_splits')
        .update({ status: 'paid' })
        .eq('id', request.id);
      if (billError) throw billError;

      if (request.session_id) {
        const { error: sessionError } = await supabase
          .from('table_sessions')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString(),
          })
          .eq('id', request.session_id);
        if (sessionError) throw sessionError;
      }

      setRequests(prev => prev.filter(r => r.id !== request.id));
    } catch {
      alert('操作失败，请重试');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mb-8">
      <h2 className="font-heading text-2xl text-brand-gold mb-4">{t.title}</h2>
      {requests.length === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-6 text-center text-brand-text-muted text-sm">
          {t.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(request => (
            <div key={request.id} className="bg-brand-card border border-brand-border rounded-xl px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-text font-medium">{t.table} {request.table_number}</p>
                  <p className="text-brand-text-muted text-[13px] mt-1">
                    {new Date(request.created_at).toLocaleString(locale)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-brand-gold font-semibold">{t.amount} €{request.total_amount.toFixed(2)}</p>
                  <span className="text-[13px] px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400">
                    {t.requested}
                  </span>
                </div>
              </div>
              {!!request.result?.length && (
                <div className="mt-3 rounded-lg border border-brand-border/60 p-3">
                  <p className="text-[13px] text-brand-text-muted mb-2">{t.splitResult}</p>
                  <div className="space-y-1.5">
                    {request.result.map((row, idx) => (
                      <div key={`${request.id}-${idx}`} className="flex items-center justify-between text-sm">
                        <span className="text-brand-text">{row.name}</span>
                        <span className="text-brand-gold">€{Number(row.amount).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => handleConfirmPaid(request)}
                disabled={processingId === request.id}
                className="mt-3 w-full bg-green-500/15 text-green-400 border border-green-500/40 rounded-lg py-2.5 text-sm font-medium hover:bg-green-500/20 disabled:opacity-50"
              >
                {processingId === request.id ? t.processing : t.confirmPaid}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
