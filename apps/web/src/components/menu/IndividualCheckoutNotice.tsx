'use client';

/**
 * Individual-checkout call notice (modal, not a float): when another phone calls checkout every
 * other phone refreshes its data and, unless it is itself waiting to pay, shows one merged
 * "who called, what they claimed" dialog (per-ticket blocks, scrollable). Silent signals only refresh.
 *
 * Sole notice content comes from `table_checkout_signals` (names + amounts stamped at call).
 */
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  formatIndividualCallNoticeEuro,
  mergeIndividualCallNoticePeople,
  normalizeIndividualCheckoutSignalItems,
  pickIndividualCallNoticeSignals,
  type IndividualCallNoticePerson,
  type IndividualCheckoutSignal,
} from '@/lib/individual-call-notice';
import { useIndividualCheckoutSignals } from '@/lib/use-individual-checkout-signals';

function normalizeSignalRows(rows: IndividualCheckoutSignal[]): IndividualCheckoutSignal[] {
  return rows.map((row) => ({
    ...row,
    items: normalizeIndividualCheckoutSignalItems(row.items),
  }));
}

export function IndividualCheckoutNotice(props: {
  sessionId: string | null | undefined;
  enabled: boolean;
  /** Called on every signal batch (call or silent): reload whatever this page shows. */
  onSignals: () => void;
  /** Phones already waiting to pay refresh silently. */
  suppressModal?: boolean;
  /** This phone's own just-called tickets (its own signal must not pop a modal). */
  getIgnoreTicketKeys?: () => ReadonlySet<string>;
}) {
  const { sessionId, enabled, onSignals, suppressModal = false, getIgnoreTicketKeys } = props;
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const [people, setPeople] = useState<IndividualCallNoticePerson[] | null>(null);

  const handleSignals = useCallback(
    (rows: IndividualCheckoutSignal[]) => {
      onSignals();
      if (suppressModal || rows.length === 0) return;
      const callSignals = pickIndividualCallNoticeSignals({
        signals: normalizeSignalRows(rows),
        ignoreTicketKeys: getIgnoreTicketKeys?.() ?? new Set(),
        nowMs: Date.now(),
      });
      if (callSignals.length === 0) return;
      setPeople((prev) =>
        mergeIndividualCallNoticePeople({
          existing: prev ?? [],
          signals: callSignals,
          lang,
        }),
      );
    },
    [getIgnoreTicketKeys, lang, onSignals, suppressModal],
  );

  useIndividualCheckoutSignals({ sessionId, enabled, onSignals: handleSignals });

  const dismiss = useMemo(() => () => setPeople(null), []);
  const open = people != null && people.length > 0;

  return (
    <Modal open={open} onClose={dismiss} title={t.callBill} size="sm">
      <div className="flex h-[min(22rem,52vh)] flex-col gap-3">
        <p className="shrink-0 text-sm text-brand-text">{t.individualCallNoticeLead}</p>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
          <div className="space-y-3">
            {(people ?? []).map((person, index) => (
              <section
                key={person.ticketKey}
                className={
                  index > 0 ? 'border-t border-brand-border pt-3' : undefined
                }
              >
                <h3 className="mb-2 text-sm font-semibold text-brand-ink">{person.name}</h3>
                {person.items.length > 0 ? (
                  <>
                    <ul className="overflow-hidden rounded-xl border border-brand-ink/10 bg-brand-bg/55">
                      {person.items.map((item) => (
                        <li
                          key={`${person.ticketKey}:${item.key}:${item.qtyLabel}`}
                          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-2 border-b border-brand-border/80 px-3 py-2.5 text-sm last:border-b-0"
                        >
                          <span className="min-w-0 truncate text-brand-text">{item.label}</span>
                          <span className="tabular-nums text-brand-text-muted">{item.qtyLabel}</span>
                          <span className="min-w-[3.6rem] text-right font-semibold tabular-nums text-brand-gold">
                            {formatIndividualCallNoticeEuro(item.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between px-0.5 text-sm">
                      <span className="text-brand-text-muted">{t.total}</span>
                      <span className="text-[15px] font-bold tabular-nums text-brand-ink">
                        {formatIndividualCallNoticeEuro(person.amount)}
                      </span>
                    </div>
                  </>
                ) : null}
              </section>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-brand-border pt-3">
          <Button
            type="button"
            variant="gold"
            size="action"
            className="min-h-11 w-full"
            onClick={dismiss}
          >
            {t.individualNoticeOk}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
