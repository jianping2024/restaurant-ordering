'use client';

/**
 * Sole guest-phone claim state (one phone = one name = one ticket). See {@link GuestClaim}.
 *
 * Seed order per open session: this phone's unlocked ticket on the server (after「恢复点单」)
 * → this phone's local draft → a fresh claim. A claim whose ticket is already paid is never
 * reused: the next dish opens a new ticket id; the name is prefilled via sole
 * {@link resolveGuestClaimPrefillName} (local last name, else this phone's server `mine` name).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ByItemConsumerRow } from '@/lib/bill-split-by-item';
import type { BillSplitOrderLine, ByItemLineSpec } from '@/lib/bill-split-by-item-lines';
import {
  applyGuestClaimRowPatch,
  buildMyTicket,
  claimAllRemaining,
  claimNameTaken,
  claimFromServerTicket,
  clampGuestClaimBuffetRows,
  clearGuestClaimDraft,
  guestClaimIssue,
  guestClaimPoolResults,
  guestOthersClaimBlocks,
  lineOverClaimed,
  loadGuestClaimDraft,
  mintGuestClaim,
  othersAllocation,
  pruneClaimRows,
  rememberGuestClaimLastName,
  resolveGuestClaimPrefillName,
  saveGuestClaimDraft,
  type GuestClaim,
} from '@/lib/guest-claim';
import type { UILanguage } from '@/lib/i18n';
import type { IndividualTicketInfo } from '@/lib/individual-checkout';
import { splitPartyKey } from '@/lib/split-party-id';
import type { BillSplit } from '@/types';

export function useGuestClaim(params: {
  restaurantId: string;
  sessionId: string | null;
  lineSpecs: ByItemLineSpec[];
  orderLines: BillSplitOrderLine[];
  existingSplit: BillSplit | null;
  tickets: ReadonlyArray<IndividualTicketInfo>;
  lang: UILanguage;
  /** True once this phone's ticket is called: the draft is frozen and the local copy dropped. */
  submitted: boolean;
}) {
  const { restaurantId, sessionId, lineSpecs, orderLines, existingSplit, tickets, lang, submitted } =
    params;

  const [claim, setClaim] = useState<GuestClaim>(() => mintGuestClaim());
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const hydrateStateRef = useRef<{ sessionId: string | null; serverKey: string }>({
    sessionId: null,
    serverKey: '',
  });

  const persons = existingSplit?.persons;
  const results = existingSplit?.result;

  const paidKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of results ?? []) {
      if (row.paid) keys.add(splitPartyKey(row.party_id, row.name));
    }
    return keys;
  }, [results]);

  /** This phone's editable ticket on the server (unlocked after a resume), if any. */
  const serverTicket = useMemo(() => {
    const mine = tickets.find((ticket) => ticket.mine && ticket.state === 'unlocked');
    if (!mine) return null;
    const person = (persons ?? []).find(
      (candidate) => splitPartyKey(candidate.party_id, candidate.name) === mine.ticket_key,
    );
    return person ? { key: mine.ticket_key, person } : null;
  }, [tickets, persons]);
  const serverKey = serverTicket?.key ?? '';

  useEffect(() => {
    if (!sessionId) return;
    const prev = hydrateStateRef.current;
    const sessionChanged = prev.sessionId !== sessionId;
    const serverChanged = prev.serverKey !== serverKey;
    if (!sessionChanged && !serverChanged) return;
    hydrateStateRef.current = { sessionId, serverKey };

    if (serverTicket) {
      setClaim(claimFromServerTicket(serverTicket.person, lineSpecs));
    } else if (sessionChanged) {
      const local = loadGuestClaimDraft(restaurantId, sessionId);
      if (local && !paidKeys.has(splitPartyKey(local.partyId, local.name))) {
        setClaim(
          clampGuestClaimBuffetRows(
            local,
            lineSpecs,
            othersAllocation(persons ?? [], local, lineSpecs),
          ),
        );
      } else {
        const name = resolveGuestClaimPrefillName({
          restaurantId,
          sessionId,
          tickets,
        });
        if (name) rememberGuestClaimLastName(restaurantId, sessionId, name);
        setClaim(mintGuestClaim(name));
      }
    }
    setHydratedFor(sessionId);
  }, [
    sessionId,
    serverKey,
    serverTicket,
    restaurantId,
    lineSpecs,
    paidKeys,
    persons,
    tickets,
  ]);

  // Paid ticket → new ticket id; keep this phone's last name (in-memory, local, or mine ticket).
  useEffect(() => {
    if (!hydratedFor || !sessionId || serverTicket) return;
    if (!paidKeys.has(splitPartyKey(claim.partyId, claim.name))) return;
    const nextName = resolveGuestClaimPrefillName({
      preferredName: claim.name,
      restaurantId,
      sessionId,
      tickets,
    });
    if (nextName) rememberGuestClaimLastName(restaurantId, sessionId, nextName);
    setClaim(mintGuestClaim(nextName));
  }, [hydratedFor, serverTicket, paidKeys, claim, restaurantId, sessionId, tickets]);

  // Tickets often arrive after first hydrate (guest_client_id). Fill empty name once from sole prefill.
  useEffect(() => {
    if (!sessionId || hydratedFor !== sessionId || serverTicket || submitted) return;
    if (claim.name.trim()) return;
    const name = resolveGuestClaimPrefillName({
      restaurantId,
      sessionId,
      tickets,
    });
    if (!name) return;
    rememberGuestClaimLastName(restaurantId, sessionId, name);
    setClaim((prev) => (prev.name.trim() ? prev : { ...prev, name }));
  }, [sessionId, hydratedFor, serverTicket, submitted, claim.name, restaurantId, tickets]);

  // Dishes that left the bill never linger in the claim.
  useEffect(() => {
    setClaim((prev) => pruneClaimRows(prev, lineSpecs));
  }, [lineSpecs]);

  // Others took buffet seats → squash any local over-claim drafts to the live ceil.
  useEffect(() => {
    setClaim((prev) =>
      clampGuestClaimBuffetRows(prev, lineSpecs, othersAllocation(persons ?? [], prev, lineSpecs)),
    );
  }, [lineSpecs, persons]);

  useEffect(() => {
    if (!sessionId || hydratedFor !== sessionId) return;
    if (submitted) {
      rememberGuestClaimLastName(restaurantId, sessionId, claim.name);
      clearGuestClaimDraft(restaurantId, sessionId);
      return;
    }
    const timer = window.setTimeout(() => saveGuestClaimDraft(restaurantId, sessionId, claim), 200);
    return () => window.clearTimeout(timer);
  }, [restaurantId, sessionId, hydratedFor, claim, submitted]);

  const others = useMemo(
    () => othersAllocation(persons ?? [], claim, lineSpecs),
    [persons, claim, lineSpecs],
  );

  /** One pool calc: call-CTA amount + others-card amounts. */
  const poolResults = useMemo(
    () => guestClaimPoolResults({ claim, lineSpecs, orderLines, others, lang }),
    [claim, lineSpecs, orderLines, others, lang],
  );

  const othersBlocks = useMemo(
    () => guestOthersClaimBlocks(persons ?? [], claim, lineSpecs, paidKeys, poolResults),
    [persons, claim, lineSpecs, paidKeys, poolResults],
  );

  const myTicket = useMemo(
    () => buildMyTicket({ claim, lineSpecs, orderLines, others, lang, poolResults }),
    [claim, lineSpecs, orderLines, others, lang, poolResults],
  );

  const issue = useMemo(
    () =>
      guestClaimIssue({
        claim,
        lineSpecs,
        others,
        results: results ?? [],
        hasClaim: myTicket.hasClaim,
      }),
    [claim, lineSpecs, others, results, myTicket.hasClaim],
  );

  const nameTaken = useMemo(() => claimNameTaken(results ?? [], claim), [results, claim]);

  const overClaimedKeys = useMemo(
    () =>
      new Set(
        lineSpecs.filter((spec) => lineOverClaimed(spec, claim, others)).map((spec) => spec.key),
      ),
    [lineSpecs, claim, others],
  );

  const setName = useCallback((name: string) => {
    setClaim((prev) => ({ ...prev, name }));
  }, []);

  const updateRow = useCallback(
    (spec: ByItemLineSpec, patch: Partial<ByItemConsumerRow>) => {
      setClaim((prev) =>
        applyGuestClaimRowPatch(
          prev,
          spec,
          patch,
          othersAllocation(persons ?? [], prev, lineSpecs),
        ),
      );
    },
    [persons, lineSpecs],
  );

  const claimRest = useCallback(() => {
    setClaim((prev) => claimAllRemaining(prev, lineSpecs, othersAllocation(persons ?? [], prev, lineSpecs)));
  }, [lineSpecs, persons]);

  return {
    claim,
    ready: hydratedFor === sessionId && !!sessionId,
    others,
    othersBlocks,
    myTicket,
    issue,
    nameTaken,
    overClaimedKeys,
    setName,
    updateRow,
    claimRest,
  };
}
