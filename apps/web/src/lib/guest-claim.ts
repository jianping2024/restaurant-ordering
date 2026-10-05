/**
 * Guest phone claim — sole by-item editing model on a customer phone: one phone, one name,
 * one ticket. The guest names themselves once and enters how much of each dish is theirs;
 * everyone else's tickets (called, unlocked, paid) are a read-only overlay on the dish pool.
 *
 * Pure rules only (no React). Persistence of the draft lives at the bottom of this file;
 * the wire shape is the same ticket the server merges (`submitIndividualCall`).
 */
import {
  buildByItemAllocationsFromPersons,
  buildByItemAllocationsFromRows,
  buildSplitPersonsFromAllocations,
  calcByItemSplitResults,
  createByItemConsumerRow,
  getByItemLineStatusFromShares,
  rationalToRowQtyFields,
  validateQtyParts,
  type ByItemConsumerRow,
  type ByItemLineAllocation,
} from '@/lib/bill-split-by-item';
import {
  byItemSplitLineFromOrderLine,
  type BillSplitOrderLine,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item-lines';
import { resolveMenuItemLocalizedName } from '@/lib/menu-item-display';
import type { UILanguage } from '@/lib/i18n';
import {
  normalizeRational,
  rationalFromNumber,
  sumRationals,
  type Rational,
} from '@/lib/rational-qty';
import { unpaidNameTakenByOther } from '@/lib/individual-checkout';
import { splitPartyKey, toWireSplitResult } from '@/lib/split-party-id';
import type { SplitPerson, SplitResult } from '@/types';

export type GuestClaim = {
  name: string;
  /** This phone's ticket id; minted once per ticket (a paid ticket is never reused). */
  partyId: string;
  /** At most one row per dish line (menu: whole/num/den; buffet: adult/child headcounts). */
  rows: Record<string, ByItemConsumerRow>;
};

export type GuestClaimIssue =
  | 'name_required'
  | 'name_taken'
  | 'nothing_claimed'
  | 'invalid_qty'
  | 'over_claim';

export function claimRowFor(claim: GuestClaim, spec: ByItemLineSpec): ByItemConsumerRow {
  return claim.rows[spec.key] ?? { ...createByItemConsumerRow({ buffet: spec.mode === 'buffet' }), partyId: claim.partyId };
}

/**
 * Rows as the allocation parsers expect them: named with the claim name + id.
 * A named buffet row with both counts blank would parse as 1 adult — an empty claim is `0`.
 */
function claimRowsByLine(
  claim: GuestClaim,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
): Record<string, ByItemConsumerRow[]> {
  const name = claim.name.trim();
  const out: Record<string, ByItemConsumerRow[]> = {};
  for (const spec of lineSpecs) {
    const row = claim.rows[spec.key];
    if (!row) continue;
    const buffetBlank =
      spec.mode === 'buffet' && !(row.adultQty ?? '').trim() && !(row.childQty ?? '').trim();
    out[spec.key] = [
      {
        ...row,
        name,
        partyId: claim.partyId,
        ...(buffetBlank ? { adultQty: '0' } : {}),
      },
    ];
  }
  return out;
}

/** Read-only overlay: every ticket on the plan except this claim's own. */
export function othersAllocation(
  persons: ReadonlyArray<SplitPerson>,
  claim: Pick<GuestClaim, 'name' | 'partyId'>,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
): ByItemLineAllocation {
  const myKey = splitPartyKey(claim.partyId, claim.name);
  const others = persons.filter((person) => splitPartyKey(person.party_id, person.name) !== myKey);
  return buildByItemAllocationsFromPersons([...others], [...lineSpecs]);
}

function subRational(a: Rational, b: Rational): Rational {
  return normalizeRational({ num: a.num * b.den - b.num * a.den, den: a.den * b.den });
}

export type LineAvailability =
  | { mode: 'menu'; claimedByOthers: Rational; remaining: Rational }
  | {
      mode: 'buffet';
      adultsClaimedByOthers: number;
      childrenClaimedByOthers: number;
      adultsRemaining: number;
      childrenRemaining: number;
    };

/** What the others already hold on this dish and what is left for this phone. */
export function lineAvailability(
  spec: ByItemLineSpec,
  others: ByItemLineAllocation,
): LineAvailability {
  const shares = others[spec.key] ?? [];
  if (spec.mode === 'buffet') {
    const sumBy = (type: 'adult' | 'child') =>
      shares
        .filter((share) => share.guestType === type)
        .reduce((total, share) => total + share.qty.num / share.qty.den, 0);
    const adults = sumBy('adult');
    const children = sumBy('child');
    return {
      mode: 'buffet',
      adultsClaimedByOthers: adults,
      childrenClaimedByOthers: children,
      adultsRemaining: Math.max(0, spec.adults - adults),
      childrenRemaining: Math.max(0, spec.children - children),
    };
  }
  const claimed = shares.length > 0 ? sumRationals(shares.map((share) => share.qty)) : { num: 0, den: 1 };
  const remaining = subRational(rationalFromNumber(spec.lineQty), claimed);
  return {
    mode: 'menu',
    claimedByOthers: claimed,
    remaining: remaining.num > 0 ? remaining : { num: 0, den: 1 },
  };
}

function mySharesOf(
  claim: GuestClaim,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
): ByItemLineAllocation {
  return buildByItemAllocationsFromRows([...lineSpecs], claimRowsByLine(claim, lineSpecs));
}

function combine(
  others: ByItemLineAllocation,
  mine: ByItemLineAllocation,
): ByItemLineAllocation {
  const out: ByItemLineAllocation = { ...others };
  for (const [key, shares] of Object.entries(mine)) {
    out[key] = [...(others[key] ?? []), ...shares];
  }
  return out;
}

/** True when this phone's claim pushes the dish past what is left (pool over-allocated). */
export function lineOverClaimed(
  spec: ByItemLineSpec,
  claim: GuestClaim,
  others: ByItemLineAllocation,
): boolean {
  const mine = mySharesOf(claim, [spec])[spec.key] ?? [];
  if (mine.length === 0) return false;
  const kind = getByItemLineStatusFromShares(spec, [...(others[spec.key] ?? []), ...mine]).kind;
  return kind === 'over' || kind === 'buffet_over';
}

function rowQtyInvalid(spec: ByItemLineSpec, row: ByItemConsumerRow | undefined): boolean {
  if (!row || spec.mode === 'buffet') return false;
  const parts = validateQtyParts({ whole: row.qtyWhole, num: row.qtyNum, den: row.qtyDen });
  return !parts.ok && parts.issue !== 'empty';
}

export type MyTicket = {
  persons: SplitPerson[];
  result: SplitResult[];
  /** Euro amount of this ticket (pool-aware cents), 0 when nothing is claimed. */
  amount: number;
  hasClaim: boolean;
};

/** This phone's ticket as the call payload; amount is computed against the live pool. */
export function buildMyTicket(params: {
  claim: GuestClaim;
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  orderLines: ReadonlyArray<BillSplitOrderLine>;
  others: ByItemLineAllocation;
  lang: UILanguage;
}): MyTicket {
  const { claim, lineSpecs, orderLines, others, lang } = params;
  const mine = mySharesOf(claim, lineSpecs);
  const persons = buildSplitPersonsFromAllocations(mine);
  if (persons.length === 0) return { persons: [], result: [], amount: 0, hasClaim: false };

  const myKey = splitPartyKey(claim.partyId, claim.name);
  const rows = calcByItemSplitResults({
    lines: orderLines.map((line) =>
      byItemSplitLineFromOrderLine(line, resolveMenuItemLocalizedName(line, lang)),
    ),
    allocations: combine(others, mine),
  })
    .map((row) => toWireSplitResult(row))
    .filter((row) => splitPartyKey(row.party_id, row.name) === myKey);
  const amount = rows[0]?.amount ?? 0;
  return { persons, result: rows, amount, hasClaim: amount > 0 };
}

/** The claim's name is used by an unpaid ticket of someone else (the sole rule lives in individual-checkout). */
export function claimNameTaken(
  results: ReadonlyArray<SplitResult>,
  claim: Pick<GuestClaim, 'name' | 'partyId'>,
): boolean {
  return unpaidNameTakenByOther(results, {
    key: splitPartyKey(claim.partyId, claim.name),
    name: claim.name,
  });
}

/** First blocking problem of the claim, or null when it can be called. */
export function guestClaimIssue(params: {
  claim: GuestClaim;
  lineSpecs: ReadonlyArray<ByItemLineSpec>;
  others: ByItemLineAllocation;
  results: ReadonlyArray<SplitResult>;
  hasClaim: boolean;
}): GuestClaimIssue | null {
  const { claim, lineSpecs, others, results, hasClaim } = params;
  if (lineSpecs.some((spec) => rowQtyInvalid(spec, claim.rows[spec.key]))) return 'invalid_qty';
  if (lineSpecs.some((spec) => lineOverClaimed(spec, claim, others))) return 'over_claim';
  if (!hasClaim) return 'nothing_claimed';
  if (!claim.name.trim()) return 'name_required';
  if (claimNameTaken(results, claim)) return 'name_taken';
  return null;
}

/** Fill every dish with whatever the others have not claimed ("I take the rest"). */
export function claimAllRemaining(
  claim: GuestClaim,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
  others: ByItemLineAllocation,
): GuestClaim {
  const rows: Record<string, ByItemConsumerRow> = {};
  for (const spec of lineSpecs) {
    const base = claimRowFor(claim, spec);
    const left = lineAvailability(spec, others);
    if (left.mode === 'buffet') {
      rows[spec.key] = {
        ...base,
        adultQty: left.adultsRemaining > 0 ? String(left.adultsRemaining) : '',
        childQty: left.childrenRemaining > 0 ? String(left.childrenRemaining) : '',
      };
      continue;
    }
    rows[spec.key] = {
      ...base,
      ...(left.remaining.num > 0
        ? rationalToRowQtyFields(left.remaining)
        : { qtyWhole: '', qtyNum: '', qtyDen: '' }),
    };
  }
  return { ...claim, rows };
}

/** Rebuild the editable claim from a ticket stored on the server (unlocked / called). */
export function claimFromServerTicket(
  person: SplitPerson,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
): GuestClaim {
  const specByKey = new Map(lineSpecs.map((spec) => [spec.key, spec] as const));
  const rows: Record<string, ByItemConsumerRow> = {};
  for (const share of person.item_shares ?? []) {
    const spec = specByKey.get(share.key);
    if (!spec || !(share.qty_num > 0)) continue;
    const base = rows[share.key] ?? {
      ...createByItemConsumerRow({ buffet: spec.mode === 'buffet' }),
      partyId: person.party_id,
    };
    if (spec.mode === 'buffet') {
      const heads = String(Math.round(share.qty_num / share.qty_den));
      rows[share.key] = share.guest_type === 'child'
        ? { ...base, childQty: heads }
        : { ...base, adultQty: heads };
    } else {
      rows[share.key] = { ...base, ...rationalToRowQtyFields({ num: share.qty_num, den: share.qty_den }) };
    }
  }
  return { name: person.name, partyId: person.party_id ?? '', rows };
}

/** Drop rows of dishes that no longer exist on the bill. */
export function pruneClaimRows(
  claim: GuestClaim,
  lineSpecs: ReadonlyArray<ByItemLineSpec>,
): GuestClaim {
  const keys = new Set(lineSpecs.map((spec) => spec.key));
  const kept = Object.entries(claim.rows).filter(([key]) => keys.has(key));
  return kept.length === Object.keys(claim.rows).length
    ? claim
    : { ...claim, rows: Object.fromEntries(kept) };
}

// ---------------------------------------------------------------------------
// Local draft (this phone only, keyed by restaurant + open session)
// ---------------------------------------------------------------------------
const DRAFT_KEY_PREFIX = 'mesa:guest-claim:';
const DRAFT_VERSION = 1 as const;

type GuestClaimDraft = GuestClaim & { v: typeof DRAFT_VERSION; updatedAt: number };

function draftKey(restaurantId: string, sessionId: string): string {
  return `${DRAFT_KEY_PREFIX}${restaurantId}:${sessionId}`;
}

function isClaimRow(value: unknown): value is ByItemConsumerRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.qtyWhole === 'string' &&
    typeof row.qtyNum === 'string' &&
    typeof row.qtyDen === 'string' &&
    (row.adultQty === undefined || typeof row.adultQty === 'string') &&
    (row.childQty === undefined || typeof row.childQty === 'string')
  );
}

export function parseGuestClaimDraft(raw: string): GuestClaim | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || parsed.v !== DRAFT_VERSION) return null;
    if (typeof parsed.name !== 'string' || typeof parsed.partyId !== 'string' || !parsed.partyId) {
      return null;
    }
    if (!parsed.rows || typeof parsed.rows !== 'object') return null;
    const rows: Record<string, ByItemConsumerRow> = {};
    for (const [key, row] of Object.entries(parsed.rows as Record<string, unknown>)) {
      if (!isClaimRow(row)) return null;
      rows[key] = row;
    }
    return { name: parsed.name, partyId: parsed.partyId, rows };
  } catch {
    return null;
  }
}

export function loadGuestClaimDraft(restaurantId: string, sessionId: string): GuestClaim | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(draftKey(restaurantId, sessionId));
    return raw ? parseGuestClaimDraft(raw) : null;
  } catch {
    return null;
  }
}

export function saveGuestClaimDraft(
  restaurantId: string,
  sessionId: string,
  claim: GuestClaim,
): void {
  if (typeof window === 'undefined') return;
  try {
    const draft: GuestClaimDraft = { ...claim, v: DRAFT_VERSION, updatedAt: Date.now() };
    localStorage.setItem(draftKey(restaurantId, sessionId), JSON.stringify(draft));
  } catch {
    /* private mode / quota — the claim stays in memory */
  }
}

export function clearGuestClaimDraft(restaurantId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(draftKey(restaurantId, sessionId));
  } catch {
    /* ignore */
  }
}
