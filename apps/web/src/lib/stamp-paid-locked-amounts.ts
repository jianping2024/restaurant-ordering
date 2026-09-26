/**
 * Stamp missing `lockedAmount` on paidLocked rows so line money freeze is stable.
 * Uses a one-shot allocate over the line's current shares (call right after hydrate,
 * before unpaid peers add more qty). Optional field — old payloads omit it.
 */
import {
  allocateByItemShareAmounts,
  parseConsumerRowQty,
  resolveBuffetRowCounts,
  type ByItemConsumerRow,
  type ByItemConsumerShare,
  type ByItemLineSpec,
} from '@/lib/bill-split-by-item';
import { rationalFromInt } from '@/lib/rational-qty';

export function stampMissingPaidLockedAmounts(
  lineSpecs: ByItemLineSpec[],
  allocations: Record<string, ByItemConsumerRow[]>,
): Record<string, ByItemConsumerRow[]> {
  let changed = false;
  const next: Record<string, ByItemConsumerRow[]> = { ...allocations };

  for (const spec of lineSpecs) {
    const rows = next[spec.key] ?? [];
    if (!rows.some((row) => row.paidLocked && row.lockedAmount == null)) continue;

    const priced: { rowId: string; share: ByItemConsumerShare }[] = [];
    if (spec.mode === 'buffet') {
      for (const row of rows) {
        if (!row.name.trim()) continue;
        const { adults, children } = resolveBuffetRowCounts(row);
        if (adults > 0) {
          priced.push({
            rowId: `${row.id}:a`,
            share: {
              name: row.name,
              qty: rationalFromInt(adults),
              guestType: 'adult',
              ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
            },
          });
        }
        if (children > 0) {
          priced.push({
            rowId: `${row.id}:c`,
            share: {
              name: row.name,
              qty: rationalFromInt(children),
              guestType: 'child',
              ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
            },
          });
        }
      }
      if (priced.length === 0) continue;
      const amounts = allocateByItemShareAmounts(
        {
          key: spec.key,
          name: '',
          mode: 'buffet',
          adults: spec.adults,
          children: spec.children,
          adultUnitPrice: spec.adultUnitPrice,
          childUnitPrice: spec.childUnitPrice,
        },
        priced.map((entry) => entry.share),
      );
      const byRow = new Map<string, number>();
      for (let i = 0; i < priced.length; i++) {
        const rowId = priced[i]!.rowId.replace(/:[ac]$/, '');
        byRow.set(rowId, Math.round(((byRow.get(rowId) ?? 0) + (amounts[i] ?? 0)) * 100) / 100);
      }
      next[spec.key] = rows.map((row) => {
        if (!row.paidLocked || row.lockedAmount != null) return row;
        const lockedAmount = byRow.get(row.id);
        if (lockedAmount == null) return row;
        changed = true;
        return { ...row, lockedAmount };
      });
      continue;
    }

    for (const row of rows) {
      if (!row.name.trim()) continue;
      const qty = parseConsumerRowQty(row);
      if (!qty) continue;
      priced.push({
        rowId: row.id,
        share: {
          name: row.name,
          qty,
          ...(row.partyId?.trim() ? { partyId: row.partyId.trim() } : {}),
        },
      });
    }
    if (priced.length === 0) continue;
    const amounts = allocateByItemShareAmounts(
      {
        key: spec.key,
        name: '',
        mode: 'menu',
        qty: spec.lineQty,
        unitPrice: spec.unitPrice,
      },
      priced.map((entry) => entry.share),
    );
    const byRow = new Map<string, number>();
    for (let i = 0; i < priced.length; i++) {
      byRow.set(priced[i]!.rowId, amounts[i] ?? 0);
    }
    next[spec.key] = rows.map((row) => {
      if (!row.paidLocked || row.lockedAmount != null) return row;
      const lockedAmount = byRow.get(row.id);
      if (lockedAmount == null) return row;
      changed = true;
      return { ...row, lockedAmount };
    });
  }

  return changed ? next : allocations;
}
