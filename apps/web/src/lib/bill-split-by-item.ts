export type ByItemSplitLine = {
  key: string;
  name: string;
  qty: number;
  /** Unit price from the order line. */
  unitPrice: number;
};

export type ByItemSplitPerson = {
  id: string;
  name: string;
};

export type ByItemSplitRow = {
  name: string;
  amount: number;
  items: Array<{ name: string; qty: number; price: number }>;
};

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Human-readable share of ordered qty when a line is split among assignees (e.g. 1/3, 2). */
export function byItemQtyShareLabel(lineQty: number, assigneeCount: number): string {
  const qty = Math.max(0, Math.round(lineQty));
  const n = Math.max(1, assigneeCount);
  if (qty === 0) return '0';
  const g = gcd(qty, n);
  const num = qty / g;
  const den = n / g;
  return den === 1 ? String(num) : `${num}/${den}`;
}

/** Assignee ids for a line key (`orderId-index`), matching bill UI person ids `p1`, `p2`, … */
export function byItemAssigneesForKey(
  persons: Array<{ items?: string[] }>,
  lineKey: string,
): string[] {
  const assignees: string[] = [];
  persons.forEach((person, idx) => {
    if ((person.items || []).includes(lineKey)) {
      assignees.push(`p${idx + 1}`);
    }
  });
  return assignees;
}

/** One person's share of a line total when split among assignees (cent-safe). */
export function byItemLineShare(lineTotal: number, assigneeIds: string[], personId: string): number {
  const n = assigneeIds.length;
  if (n === 0) return 0;
  const idx = assigneeIds.indexOf(personId);
  if (idx < 0) return 0;

  const sorted = [...assigneeIds].sort();
  const sortedIdx = sorted.indexOf(personId);
  const totalCents = Math.round(lineTotal * 100);
  const base = Math.floor(totalCents / n);
  const remainder = totalCents - base * n;
  const cents = base + (sortedIdx < remainder ? 1 : 0);
  return cents / 100;
}

export function calcByItemSplitResults(params: {
  people: ByItemSplitPerson[];
  lines: ByItemSplitLine[];
  assign: Record<string, string[]>;
}): ByItemSplitRow[] {
  const { people, lines, assign } = params;

  return people.map((person) => {
    const items: ByItemSplitRow['items'] = [];

    for (const line of lines) {
      const assignees = assign[line.key] || [];
      if (!assignees.includes(person.id)) continue;

      const lineTotal = line.unitPrice * line.qty;
      const share = byItemLineShare(lineTotal, assignees, person.id);
      items.push({
        name: line.name.trim(),
        qty: line.qty,
        price: share,
      });
    }

    const amount = items.reduce((sum, it) => sum + it.price, 0);
    return {
      name: person.name,
      amount: Math.round(amount * 100) / 100,
      items,
    };
  });
}
