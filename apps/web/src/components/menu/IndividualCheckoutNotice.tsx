'use client';

/**
 * Individual-checkout call notice (modal, not a float): when another phone calls checkout every
 * other phone refreshes its data and, unless it is itself waiting to pay, shows one merged
 * "who called, what they claimed" dialog. Silent signals (unlock, staff edit, payment) only refresh.
 */
import { useCallback, useMemo, useState } from 'react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { getMessages } from '@/lib/i18n/messages';
import {
  formatIndividualCallNotice,
  pickIndividualCallNoticeSignals,
  type IndividualCheckoutSignal,
} from '@/lib/individual-call-notice';
import { useIndividualCheckoutSignals } from '@/lib/use-individual-checkout-signals';

export function IndividualCheckoutNotice(props: {
  sessionId: string | null | undefined;
  enabled: boolean;
  /** Called on every signal batch (call or silent): reload whatever this page shows. */
  onSignals: () => void;
  /** Phones already waiting to pay refresh silently. */
  suppressModal?: boolean;
  /** This phone's own just-called tickets (its own signal must not pop a modal). */
  getIgnoreTicketKeys?: () => ReadonlySet<string>;
  resolveLineName?: (lineKey: string) => string | null;
}) {
  const { sessionId, enabled, onSignals, suppressModal = false, getIgnoreTicketKeys, resolveLineName } =
    props;
  const { lang } = useLanguage();
  const t = getMessages(lang).bill;
  const [message, setMessage] = useState<string | null>(null);

  const handleSignals = useCallback(
    (rows: IndividualCheckoutSignal[]) => {
      onSignals();
      if (suppressModal || rows.length === 0) return;
      const callSignals = pickIndividualCallNoticeSignals({
        signals: rows,
        ignoreTicketKeys: getIgnoreTicketKeys?.() ?? new Set(),
        nowMs: Date.now(),
      });
      if (callSignals.length === 0) return;
      const text = formatIndividualCallNotice({
        signals: callSignals,
        resolveLineName,
        labels: {
          withItems: t.individualCalledByOther,
          withoutItems: t.individualCalledByOtherNoItems,
        },
      });
      setMessage((prev) => (prev ? `${prev}\n${text}` : text));
    },
    [getIgnoreTicketKeys, onSignals, resolveLineName, suppressModal, t],
  );

  useIndividualCheckoutSignals({ sessionId, enabled, onSignals: handleSignals });

  const dismiss = useMemo(() => () => setMessage(null), []);

  return (
    <ConfirmModal
      open={message != null}
      onClose={dismiss}
      title={t.callBill}
      message={message ?? ''}
      confirmLabel={t.individualNoticeOk}
      onConfirm={dismiss}
    />
  );
}
