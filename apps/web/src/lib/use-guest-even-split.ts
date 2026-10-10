'use client';

/**
 * Sole guest-phone even-split roster (people ± and names).
 * Seat identity = party_id via {@link ensureEvenPersonDrafts}.
 * Amounts via {@link computeSplitResults} — same as staff even path.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { computeSplitResults } from '@/lib/bill-split-draft';
import {
  allocationLockedEvenPartyIds,
  defaultEvenPersonDrafts,
  ensureEvenPersonDrafts,
  evenPersonDraftsFromSplit,
  type EvenPersonDraft,
} from '@/lib/even-split-party';
import { splitDraftPersonCount } from '@/lib/checkout-split-continuation';
import { buildCustomerSplitDisplayRows } from '@/lib/customer-bill-split-display';
import type { SessionCollectedPayment } from '@/lib/checkout-session-payments';
import type { UILanguage } from '@/lib/i18n';
import type { BillSplit, SplitPerson, SplitResult } from '@/types';

export type GuestEvenPersonSlot = EvenPersonDraft & { id: string };

function slotsFromDrafts(drafts: readonly EvenPersonDraft[]): GuestEvenPersonSlot[] {
  return drafts.map((row) => ({
    id: row.partyId,
    partyId: row.partyId,
    name: row.name,
  }));
}

export function useGuestEvenSplit(params: {
  existingSplit: BillSplit | null;
  total: number;
  guestName: (n: number) => string;
  collectedPayments: SessionCollectedPayment[];
  lang: UILanguage;
  locked: boolean;
}) {
  const { existingSplit, total, guestName, collectedPayments, locked } = params;

  const [personCount, setPersonCount] = useState(() => {
    const drafts = evenPersonDraftsFromSplit(existingSplit, guestName);
    return splitDraftPersonCount(drafts?.length);
  });
  const [splitPeople, setSplitPeople] = useState<GuestEvenPersonSlot[]>(() => {
    const drafts = evenPersonDraftsFromSplit(existingSplit, guestName);
    return slotsFromDrafts(drafts ?? defaultEvenPersonDrafts(guestName));
  });
  const [editingSplitNameIndex, setEditingSplitNameIndex] = useState<number | null>(null);
  const [editingSplitNameValue, setEditingSplitNameValue] = useState('');

  const lockedEvenPartyIds = useMemo(
    () => allocationLockedEvenPartyIds(existingSplit, collectedPayments),
    [existingSplit, collectedPayments],
  );

  useEffect(() => {
    if (existingSplit?.split_mode !== 'even') return;
    const drafts = evenPersonDraftsFromSplit(existingSplit, guestName);
    if (!drafts) return;
    setPersonCount(splitDraftPersonCount(drafts.length));
    setSplitPeople(slotsFromDrafts(drafts));
  }, [existingSplit, guestName]);

  useEffect(() => {
    setSplitPeople((prev) =>
      slotsFromDrafts(ensureEvenPersonDrafts(prev, personCount, guestName)),
    );
  }, [personCount, guestName]);

  const results: SplitResult[] = useMemo(
    () =>
      computeSplitResults({
        splitMode: 'even',
        total,
        orderLines: [],
        lineSpecs: [],
        personCount,
        splitPeople,
        byItemDraftRows: {},
        parsedByItemAllocations: {},
        lang: params.lang,
      }),
    [total, personCount, splitPeople, params.lang],
  );

  const splitDisplayRows = useMemo(
    () => buildCustomerSplitDisplayRows(results, collectedPayments, 0, total),
    [results, collectedPayments, total],
  );

  const incrementPersonCount = useCallback(() => {
    if (locked) return;
    setPersonCount((n) => splitDraftPersonCount(n + 1));
  }, [locked]);

  const decrementPersonCount = useCallback(() => {
    if (locked) return;
    setPersonCount((n) => splitDraftPersonCount(n - 1));
  }, [locked]);

  const startInlineRename = useCallback(
    (index: number) => {
      if (locked) return;
      const current = splitPeople[index];
      if (!current) return;
      if (lockedEvenPartyIds.has(current.partyId)) return;
      setEditingSplitNameIndex(index);
      setEditingSplitNameValue(current.name);
    },
    [locked, splitPeople, lockedEvenPartyIds],
  );

  const commitInlineRename = useCallback(
    (index: number) => {
      const current = splitPeople[index];
      if (current && lockedEvenPartyIds.has(current.partyId)) {
        setEditingSplitNameIndex(null);
        setEditingSplitNameValue('');
        return;
      }
      const normalized = editingSplitNameValue.trim() || guestName(index + 1);
      setSplitPeople((prev) =>
        prev.map((person, idx) => (idx === index ? { ...person, name: normalized } : person)),
      );
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    [editingSplitNameValue, guestName, splitPeople, lockedEvenPartyIds],
  );

  const buildPayload = useCallback((): { persons: SplitPerson[]; result: SplitResult[] } => {
    const persons = results.map((row) => ({
      name: row.name,
      ...(row.party_id ? { party_id: row.party_id } : {}),
    }));
    return { persons, result: results };
  }, [results]);

  return {
    personCount,
    splitPeople,
    results,
    splitDisplayRows,
    editingSplitNameIndex,
    editingSplitNameValue,
    setEditingSplitNameValue,
    incrementPersonCount,
    decrementPersonCount,
    startInlineRename,
    commitInlineRename,
    cancelInlineRename: () => {
      setEditingSplitNameIndex(null);
      setEditingSplitNameValue('');
    },
    lockedEvenPartyIds,
    buildPayload,
  };
}
