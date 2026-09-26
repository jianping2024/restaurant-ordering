import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import {
  addBuffetSeatToPerson,
  addMenuFractionShareToPerson,
  addWholeShareToPerson,
  assignAllRemainingPoolToPerson,
  byItemMenuQtyDenReadOnly,
  isStaffMenuShareOverAllocated,
  menuFractionDenominatorFromRemaining,
  setPersonMenuShareQtyFields,
  staffByItemPeopleFromAllocations,
  staffByItemPersonShares,
  staffByItemPoolLines,
  staffByItemShareLineMetaParts,
} from './staff-by-item-workbench';
import {
  buildByItemAllocationsFromRows,
  calcByItemSplitResults,
  locateByItemSplitResult,
} from './bill-split-by-item';
import { byItemSplitLineFromOrderLine } from './bill-split-by-item-lines';
import { resolveMenuItemLocalizedName } from './menu-item-display';

const menuSpec: ByItemLineSpec = {
  mode: 'menu',
  key: 'line-a',
  lineQty: 2,
  lineTotal: 5,
  unitPrice: 2.5,
};

const orderLine = {
  key: 'line-a',
  name: 'Vitalis',
  name_zh: 'Vitalis',
  name_en: 'Vitalis',
  name_pt: 'Vitalis',
  price: 2.5,
  quantity: 2,
  status: 'pending' as const,
};

function emptyRows(): ByItemConsumerRow[] {
  return [{
    id: 'row-1',
    name: '',
    qtyWhole: '',
    qtyNum: '',
    qtyDen: '',
  }];
}

describe('menuFractionDenominatorFromRemaining', () => {
  it('uses remaining den when leftover is a proper fraction', () => {
    assert.equal(menuFractionDenominatorFromRemaining({ num: 2, den: 3 }), 3);
    assert.equal(menuFractionDenominatorFromRemaining({ num: 1, den: 2 }), 2);
  });

  it('defaults to 2 when remaining is a whole number of cups', () => {
    assert.equal(menuFractionDenominatorFromRemaining({ num: 1, den: 1 }), 2);
    assert.equal(menuFractionDenominatorFromRemaining({ num: 4, den: 1 }), 2);
  });
});

describe('staffByItemPoolLines', () => {
  it('shows full remaining before any allocation', () => {
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: { 'line-a': emptyRows() },
      lang: 'zh',
    });
    assert.equal(pool.length, 1);
    assert.equal(pool[0]!.remainingLabel, '2');
    assert.equal(pool[0]!.unitPriceLabel, '€2.50');
    assert.equal(pool[0]!.canAddWhole, true);
    assert.equal(pool[0]!.fractionDenominator, 2);
    assert.equal(pool[0]!.canAddFraction, true);
  });

  it('uses remaining den for 1/N when leftover is a proper fraction', () => {
    const unitSpec: ByItemLineSpec = {
      mode: 'menu',
      key: 'line-unit',
      lineQty: 1,
      lineTotal: 1.85,
      unitPrice: 1.85,
    };
    const unitLine = { ...orderLine, key: 'line-unit', quantity: 1, price: 1.85 };
    const pool = staffByItemPoolLines({
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: {
        'line-unit': [{
          id: 'row-a',
          name: '客人 1',
          qtyWhole: '',
          qtyNum: '1',
          qtyDen: '3',
        }],
      },
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingLabel, '2/3');
    assert.equal(pool[0]!.fractionDenominator, 3);
    assert.equal(pool[0]!.canAddFraction, true);
  });

  it('ignores unnamed seed qtyWhole when computing remaining', () => {
    const unitSpec: ByItemLineSpec = {
      mode: 'menu',
      key: 'line-unit',
      lineQty: 1,
      lineTotal: 3,
      unitPrice: 3,
    };
    const unitLine = { ...orderLine, key: 'line-unit', quantity: 1, price: 3 };
    const pool = staffByItemPoolLines({
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: {
        'line-unit': [{
          id: 'row-seed',
          name: '',
          qtyWhole: '1',
          qtyNum: '',
          qtyDen: '',
        }],
      },
      lang: 'zh',
    });
    assert.equal(pool.length, 1);
    assert.equal(pool[0]!.remainingLabel, '1');
    assert.equal(pool[0]!.remainingPositive, true);
    assert.equal(pool[0]!.canAddWhole, true);
  });

  it('labels buffet unit price with /C only when the line has child seats', () => {
    const adultOnly: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-a',
      lineTotal: 14.95,
      adults: 1,
      children: 0,
      adultUnitPrice: 14.95,
      childUnitPrice: 9.5,
    };
    const withChild: ByItemLineSpec = {
      ...adultOnly,
      key: 'bf-ac',
      lineTotal: 24.45,
      children: 1,
    };
    const adultLine = {
      ...orderLine,
      key: 'bf-a',
      name: 'Buffet',
      adult_count: 1,
      child_count: 0,
      adult_unit_price: 14.95,
      child_unit_price: 9.5,
    };
    const childLine = { ...adultLine, key: 'bf-ac', adult_count: 1, child_count: 1 };
    const emptyBuffet = (): ByItemConsumerRow[] => [{
      id: 'row-1',
      name: '',
      qtyWhole: '',
      qtyNum: '',
      qtyDen: '',
      adultQty: '',
      childQty: '',
    }];

    const alone = staffByItemPoolLines({
      lineSpecs: [adultOnly],
      orderLines: [adultLine],
      allocations: { 'bf-a': emptyBuffet() },
      lang: 'zh',
    });
    assert.equal(alone[0]!.unitPriceLabel, '€14.95/A');

    const both = staffByItemPoolLines({
      lineSpecs: [withChild],
      orderLines: [childLine],
      allocations: { 'bf-ac': emptyBuffet() },
      lang: 'zh',
    });
    assert.equal(both[0]!.unitPriceLabel, '€14.95/A · €9.50/C');
  });
});

describe('addWholeShareToPerson / addMenuFractionShareToPerson', () => {
  it('keeps prior person shares when adding for another person', () => {
    let allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': emptyRows(),
    };
    const afterAna = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
    });
    assert.ok(afterAna);
    allocations = afterAna;
    const afterJoao = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'João',
    });
    assert.ok(afterJoao);
    allocations = afterJoao;

    const people = staffByItemPeopleFromAllocations(allocations);
    assert.ok(people.some((p) => p.name === 'Ana'));
    assert.ok(people.some((p) => p.name === 'João'));

    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    const joao = staffByItemPersonShares({
      personName: 'João',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(ana.length, 1);
    assert.equal(joao.length, 1);
    assert.equal(ana[0]!.qtyLabel, '1');
    assert.equal(ana[0]!.unitPriceLabel, '€2.50');
    assert.equal(joao[0]!.qtyLabel, '1');
    assert.equal(joao[0]!.unitPriceLabel, '€2.50');

    // Same obligation source as person-rail chip amounts + collect.
    const built = buildByItemAllocationsFromRows([menuSpec], allocations);
    const results = calcByItemSplitResults({
      lines: [
        byItemSplitLineFromOrderLine(
          orderLine,
          resolveMenuItemLocalizedName(orderLine, 'zh'),
        ),
      ],
      allocations: built,
    });
    assert.equal(results.length, 2);
    assert.equal(locateByItemSplitResult(results, 'Ana')?.row.amount, 2.5);
    assert.equal(locateByItemSplitResult(results, 'João')?.row.amount, 2.5);
    assert.equal(
      results.reduce((sum, row) => sum + row.amount, 0),
      5,
    );

    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingPositive, false);
  });

  it('splits unequal multi-person amounts (whole + half) for chip rail', () => {
    let allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': emptyRows(),
    };
    const afterAna = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
    });
    assert.ok(afterAna);
    allocations = afterAna;
    const afterJoaoHalf = addMenuFractionShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'João',
      denominator: 2,
    });
    assert.ok(afterJoaoHalf);
    allocations = afterJoaoHalf;

    const built = buildByItemAllocationsFromRows([menuSpec], allocations);
    const results = calcByItemSplitResults({
      lines: [
        byItemSplitLineFromOrderLine(
          orderLine,
          resolveMenuItemLocalizedName(orderLine, 'zh'),
        ),
      ],
      allocations: built,
    });
    assert.equal(locateByItemSplitResult(results, 'Ana')?.row.amount, 2.5);
    assert.equal(locateByItemSplitResult(results, 'João')?.row.amount, 1.25);
  });

  it('adds half then whole without dropping other people', () => {
    let allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': emptyRows(),
    };
    const afterHalf = addMenuFractionShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
    });
    assert.ok(afterHalf);
    allocations = afterHalf;
    const afterWhole = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
    });
    assert.ok(afterWhole);
    allocations = afterWhole;
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(ana[0]!.qtyLabel, '1 1/2');
  });
});

describe('addBuffetSeatToPerson', () => {
  it('adds exactly one adult seat from an empty named row', () => {
    const buffetSpec: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-1',
      lineTotal: 29.9,
      adults: 2,
      children: 0,
      adultUnitPrice: 14.95,
      childUnitPrice: 0,
    };
    const allocations = {
      'bf-1': [{
        id: 'row-1',
        name: '',
        qtyWhole: '',
        qtyNum: '',
        qtyDen: '',
        adultQty: '',
        childQty: '',
      }],
    };
    const next = addBuffetSeatToPerson({
      allocations,
      lineSpecs: [buffetSpec],
      lineKey: 'bf-1',
      personName: 'Ana',
      guestType: 'adult',
    });
    assert.ok(next);
    const row = next!['bf-1']!.find((r) => r.name === 'Ana');
    assert.ok(row);
    assert.equal(row!.adultQty, '1');
    assert.equal(row!.childQty, '');
  });

  it('clears seed adultQty=1 on empty row before adding one seat', () => {
    const buffetSpec: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-1',
      lineTotal: 29.9,
      adults: 2,
      children: 0,
      adultUnitPrice: 14.95,
      childUnitPrice: 0,
    };
    const allocations = {
      'bf-1': [{
        id: 'row-seed',
        name: '',
        qtyWhole: '',
        qtyNum: '',
        qtyDen: '',
        adultQty: '1',
        childQty: '',
      }],
    };
    const next = addBuffetSeatToPerson({
      allocations,
      lineSpecs: [buffetSpec],
      lineKey: 'bf-1',
      personName: 'Ana',
      guestType: 'adult',
    });
    assert.ok(next);
    assert.equal(next!['bf-1']!.find((r) => r.name === 'Ana')!.adultQty, '1');
  });

  it('clears seed qtyWhole=1 on empty menu row before adding one whole', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [{
        id: 'row-seed',
        name: '',
        qtyWhole: '1',
        qtyNum: '',
        qtyDen: '',
      }],
    };
    const next = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
    });
    assert.ok(next);
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(ana[0]!.qtyLabel, '1');
  });

  it('can add whole on lineQty=1 despite unnamed seed qtyWhole=1', () => {
    const unitSpec: ByItemLineSpec = {
      mode: 'menu',
      key: 'line-unit',
      lineQty: 1,
      lineTotal: 3,
      unitPrice: 3,
    };
    const unitLine = { ...orderLine, key: 'line-unit', quantity: 1, price: 3 };
    const next = addWholeShareToPerson({
      allocations: {
        'line-unit': [{
          id: 'row-seed',
          name: '',
          qtyWhole: '1',
          qtyNum: '',
          qtyDen: '',
        }],
      },
      lineSpecs: [unitSpec],
      lineKey: 'line-unit',
      personName: 'Ana',
    });
    assert.ok(next);
    const pool = staffByItemPoolLines({
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingPositive, false);
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(ana[0]!.qtyLabel, '1');
  });
});

describe('assignAllRemainingPoolToPerson', () => {
  it('drains multi-unit menu remaining in one write (not one-at-a-time)', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': emptyRows(),
    };
    const next = assignAllRemainingPoolToPerson({
      allocations,
      lineSpecs: [menuSpec],
      personName: 'Ana',
    });
    assert.ok(next);
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(ana.length, 1);
    assert.equal(ana[0]!.qtyLabel, '2');
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingPositive, false);
  });

  it('drains fractional menu leftover in one write', () => {
    const unitSpec: ByItemLineSpec = {
      mode: 'menu',
      key: 'line-unit',
      lineQty: 1,
      lineTotal: 3,
      unitPrice: 3,
    };
    const unitLine = { ...orderLine, key: 'line-unit', quantity: 1, price: 3 };
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-unit': [{
        id: 'row-a',
        name: 'João',
        qtyWhole: '',
        qtyNum: '1',
        qtyDen: '2',
      }],
    };
    const next = assignAllRemainingPoolToPerson({
      allocations,
      lineSpecs: [unitSpec],
      personName: 'Ana',
    });
    assert.ok(next);
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(ana[0]!.qtyLabel, '1/2');
    const pool = staffByItemPoolLines({
      lineSpecs: [unitSpec],
      orderLines: [unitLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingPositive, false);
  });

  it('drains buffet adult + child remaining in one write', () => {
    const buffetSpec: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-1',
      lineTotal: 39.4,
      adults: 2,
      children: 1,
      adultUnitPrice: 14.95,
      childUnitPrice: 9.5,
    };
    const buffetLine = {
      ...orderLine,
      key: 'bf-1',
      name: 'Buffet',
      adult_count: 2,
      child_count: 1,
      adult_unit_price: 14.95,
      child_unit_price: 9.5,
    };
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'bf-1': [{
        id: 'row-1',
        name: '',
        qtyWhole: '',
        qtyNum: '',
        qtyDen: '',
        adultQty: '',
        childQty: '',
      }],
    };
    const next = assignAllRemainingPoolToPerson({
      allocations,
      lineSpecs: [buffetSpec],
      personName: 'Ana',
    });
    assert.ok(next);
    const row = next!['bf-1']!.find((r) => r.name === 'Ana');
    assert.ok(row);
    assert.equal(row!.adultQty, '2');
    assert.equal(row!.childQty, '1');
    const pool = staffByItemPoolLines({
      lineSpecs: [buffetSpec],
      orderLines: [buffetLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingPositive, false);
  });

  it('assigns menu + buffet together and leaves prior person shares', () => {
    const buffetSpec: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-1',
      lineTotal: 14.95,
      adults: 1,
      children: 0,
      adultUnitPrice: 14.95,
      childUnitPrice: 0,
    };
    let allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': emptyRows(),
      'bf-1': [{
        id: 'row-bf',
        name: '',
        qtyWhole: '',
        qtyNum: '',
        qtyDen: '',
        adultQty: '',
        childQty: '',
      }],
    };
    const afterJoao = addWholeShareToPerson({
      allocations,
      lineSpecs: [menuSpec, buffetSpec],
      lineKey: 'line-a',
      personName: 'João',
    });
    assert.ok(afterJoao);
    allocations = afterJoao;

    const next = assignAllRemainingPoolToPerson({
      allocations,
      lineSpecs: [menuSpec, buffetSpec],
      personName: 'Ana',
    });
    assert.ok(next);

    const joao = staffByItemPersonShares({
      personName: 'João',
      lineSpecs: [menuSpec, buffetSpec],
      orderLines: [orderLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(joao.length, 1);
    assert.equal(joao[0]!.qtyLabel, '1');

    const anaMenu = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: next!,
      lang: 'zh',
    });
    assert.equal(anaMenu[0]!.qtyLabel, '1');

    const bfRow = next!['bf-1']!.find((r) => r.name === 'Ana');
    assert.equal(bfRow?.adultQty, '1');

    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec, buffetSpec],
      orderLines: [
        orderLine,
        {
          ...orderLine,
          key: 'bf-1',
          adult_count: 1,
          child_count: 0,
          adult_unit_price: 14.95,
          child_unit_price: 0,
        },
      ],
      allocations: next!,
      lang: 'zh',
    });
    assert.ok(pool.every((line) => !line.remainingPositive));
  });

  it('returns null when name empty or pool already empty', () => {
    assert.equal(
      assignAllRemainingPoolToPerson({
        allocations: { 'line-a': emptyRows() },
        lineSpecs: [menuSpec],
        personName: '  ',
      }),
      null,
    );
    const full = assignAllRemainingPoolToPerson({
      allocations: { 'line-a': emptyRows() },
      lineSpecs: [menuSpec],
      personName: 'Ana',
    });
    assert.ok(full);
    assert.equal(
      assignAllRemainingPoolToPerson({
        allocations: full!,
        lineSpecs: [menuSpec],
        personName: 'Ana',
      }),
      null,
    );
  });
});

describe('setPersonMenuShareQtyFields', () => {
  it('keeps pool remaining aligned with parseConsumerRows', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [
        {
          id: 'row-ana',
          name: 'Ana',
          qtyWhole: '1',
          qtyNum: '',
          qtyDen: '',
        },
        {
          id: 'row-seed',
          name: '',
          qtyWhole: '1',
          qtyNum: '',
          qtyDen: '',
        },
      ],
    };
    const half = setPersonMenuShareQtyFields({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'row-ana',
      patch: { qtyWhole: '', qtyNum: '1', qtyDen: '2' },
    });
    assert.ok(half);
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: half!,
      lang: 'zh',
    });
    // lineQty=2, named share 1/2 → remaining 3/2
    assert.equal(pool[0]!.remainingLabel, '1 1/2');
    assert.equal(pool[0]!.remainingPositive, true);
    const ana = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: half!,
      lang: 'zh',
    });
    assert.equal(ana[0]!.qtyLabel, '1/2');
    assert.equal(isStaffMenuShareOverAllocated({
      allocations: half!,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'row-ana',
    }), false);
  });

  it('rejects qty edits on paidLocked rows', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [
        {
          id: 'row-paid',
          name: 'Ana',
          qtyWhole: '',
          qtyNum: '1',
          qtyDen: '2',
          paidLocked: true,
        },
      ],
    };
    const next = setPersonMenuShareQtyFields({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'row-paid',
      patch: { qtyWhole: '', qtyNum: '1', qtyDen: '5' },
    });
    assert.equal(next, null);
  });

  it('freezes qtyDen for unpaid peers when the line has a paid share', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [
        {
          id: 'row-paid',
          name: 'Ana',
          qtyWhole: '',
          qtyNum: '1',
          qtyDen: '3',
          paidLocked: true,
        },
        {
          id: 'row-open',
          name: 'Bob',
          qtyWhole: '',
          qtyNum: '1',
          qtyDen: '2',
        },
      ],
    };
    assert.equal(byItemMenuQtyDenReadOnly(allocations['line-a']!), true);
    const next = setPersonMenuShareQtyFields({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'row-open',
      patch: { qtyWhole: '', qtyNum: '1', qtyDen: '5' },
    });
    assert.ok(next);
    const bob = next!['line-a']!.find((row) => row.id === 'row-open');
    assert.equal(bob?.qtyDen, '2');
    assert.equal(bob?.qtyNum, '1');
  });

  it('allows qtyDen edits when no share on the line is paid', () => {
    assert.equal(byItemMenuQtyDenReadOnly([{ paidLocked: undefined }]), false);
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [
        {
          id: 'row-open',
          name: 'Bob',
          qtyWhole: '',
          qtyNum: '1',
          qtyDen: '2',
        },
      ],
    };
    const next = setPersonMenuShareQtyFields({
      allocations,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'row-open',
      patch: { qtyWhole: '', qtyNum: '1', qtyDen: '5' },
    });
    assert.equal(next!['line-a']![0]!.qtyDen, '5');
  });
});

describe('staffByItemPersonShares visibility', () => {
  it('keeps named menu row while qty num/den incomplete', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [{
        id: 'row-ana',
        name: 'Ana',
        qtyWhole: '1',
        qtyNum: '1',
        qtyDen: '',
      }],
    };
    const shares = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(shares.length, 1);
    assert.equal(shares[0]!.rowId, 'row-ana');
    assert.equal(shares[0]!.qtyLabel, '—');
    assert.equal(shares[0]!.amount, 0);
    assert.equal(shares[0]!.qtyNum, '1');
    assert.equal(shares[0]!.qtyDen, '');
  });

  it('keeps named menu row for improper fraction while editing', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [{
        id: 'row-ana',
        name: 'Ana',
        qtyWhole: '',
        qtyNum: '1',
        qtyDen: '1',
      }],
    };
    const shares = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(shares.length, 1);
    assert.equal(shares[0]!.amount, 0);
    assert.equal(shares[0]!.unitPriceLabel, '€2.50');
  });
});

describe('staffByItemShareLineMetaParts', () => {
  it('marks amount ready with euro text when qty is known', () => {
    assert.deepEqual(
      staffByItemShareLineMetaParts({
        qtyLabel: '1 1/2',
        unitPriceLabel: '€2.20',
        amount: 3.3,
      }),
      { factorText: '1 1/2 × €2.20', amountText: '€3.30', amountReady: true },
    );
  });

  it('keeps amount slot with muted — placeholder when qty is incomplete (never €0.00)', () => {
    assert.deepEqual(
      staffByItemShareLineMetaParts({
        qtyLabel: '—',
        unitPriceLabel: '€2.50',
        amount: 0,
      }),
      { factorText: '— × €2.50', amountText: '—', amountReady: false },
    );
  });
});
