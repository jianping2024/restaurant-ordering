import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ByItemConsumerRow } from './bill-split-by-item';
import type { ByItemLineSpec } from './bill-split-by-item-lines';
import {
  addBuffetSeatToPerson,
  addMenuFractionShareToPerson,
  addWholeShareToPerson,
  assignAllRemainingPoolToPerson,
  returnBuffetSeatToPool,
  returnMenuShareToPool,
  staffByItemBuffetShareLineMetaParts,
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
    assert.equal(pool[0]!.fractionUnit, null);
    assert.deepEqual(pool[0]!.fractionUnitChoices, [2, 3, 4, 5]);
  });

  it('fixes 1/N to the cut of the shares already taken', () => {
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
          unitDen: 3,
        }],
      },
      lang: 'zh',
    });
    assert.equal(pool[0]!.remainingLabel, '2/3');
    assert.equal(pool[0]!.fractionUnit, 3);
    assert.deepEqual(pool[0]!.fractionUnitChoices, [3]);
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
      unitDen: 2,
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
      unitDen: 2,
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

describe('staffByItemPersonShares', () => {
  it('lists named menu rows with a qty and what each can give back', () => {
    const allocations: Record<string, ByItemConsumerRow[]> = {
      'line-a': [{
        id: 'row-ana',
        name: 'Ana',
        qtyWhole: '1',
        qtyNum: '1',
        qtyDen: '3',
        unitDen: 3,
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
    assert.equal(shares[0]!.qtyLabel, '1 1/3');
    assert.equal(shares[0]!.fractionUnit, 3);
    assert.equal(shares[0]!.canReturnWhole, true);
    assert.equal(shares[0]!.canReturnFraction, true);
  });

  it('cannot return a whole from a share smaller than 1, nor a fraction on a whole-only line', () => {
    const third = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: {
        'line-a': [{ id: 'r', name: 'Ana', qtyWhole: '', qtyNum: '1', qtyDen: '3', unitDen: 3 }],
      },
      lang: 'zh',
    });
    assert.equal(third[0]!.canReturnWhole, false);
    assert.equal(third[0]!.canReturnFraction, true);

    const whole = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: { 'line-a': [{ id: 'r', name: 'Ana', qtyWhole: '1', qtyNum: '', qtyDen: '' }] },
      lang: 'zh',
    });
    assert.equal(whole[0]!.canReturnWhole, true);
    assert.equal(whole[0]!.canReturnFraction, false);
    assert.equal(whole[0]!.fractionUnit, null);
  });

  it('never lets a paid share give anything back', () => {
    const shares = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: {
        'line-a': [{
          id: 'r',
          name: 'Ana',
          qtyWhole: '1',
          qtyNum: '',
          qtyDen: '',
          paidLocked: true,
          lockedAmount: 2.5,
        }],
      },
      lang: 'zh',
    });
    assert.equal(shares[0]!.canReturnWhole, false);
    assert.equal(shares[0]!.canReturnFraction, false);
  });
});

describe('fraction unit on the pool', () => {
  const third = (id: string, name: string, extra: Partial<ByItemConsumerRow> = {}): ByItemConsumerRow => ({
    id,
    name,
    qtyWhole: '',
    qtyNum: '1',
    qtyDen: '3',
    unitDen: 3,
    ...extra,
  });

  it('free line: any unit that fits is offered and nothing is fixed', () => {
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: { 'line-a': emptyRows() },
      lang: 'zh',
    });
    assert.equal(pool[0]!.fractionUnit, null);
    assert.deepEqual(pool[0]!.fractionUnitChoices, [2, 3, 4, 5]);
  });

  it('a fractional share fixes the cut for the whole line', () => {
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: { 'line-a': [third('a', 'Ana')] },
      lang: 'zh',
    });
    assert.equal(pool[0]!.fractionUnit, 3);
    assert.deepEqual(pool[0]!.fractionUnitChoices, [3]);
  });

  it('keeps the cut after the shares add up to whole portions (explicit unit survives)', () => {
    const half = (id: string, name: string): ByItemConsumerRow => ({
      id,
      name,
      qtyWhole: '',
      qtyNum: '1',
      qtyDen: '2',
      unitDen: 2,
    });
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: { 'line-a': [half('a', 'Ana'), half('b', 'Joao')] },
      lang: 'zh',
    });
    // 1/2 + 1/2 = 1 whole taken, 1 left — the line still reports its cut.
    assert.equal(pool[0]!.remainingLabel, '1');
    assert.equal(pool[0]!.fractionUnit, 2);
  });

  it('a paid fractional share also fixes the cut', () => {
    const pool = staffByItemPoolLines({
      lineSpecs: [menuSpec],
      orderLines: [orderLine],
      allocations: {
        'line-a': [third('a', 'Ana', { paidLocked: true, lockedAmount: 0.83 })],
      },
      lang: 'zh',
    });
    assert.equal(pool[0]!.fractionUnit, 3);
  });

  it('picking a unit stamps it on the share; the line then refuses another unit', () => {
    const afterPick = addMenuFractionShareToPerson({
      allocations: { 'line-a': emptyRows() },
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Ana',
      unitDen: 4,
    });
    assert.ok(afterPick);
    const row = afterPick['line-a']!.find((r) => r.name === 'Ana')!;
    assert.equal(row.unitDen, 4);
    assert.equal(row.qtyDen, '4');

    assert.equal(
      addMenuFractionShareToPerson({
        allocations: afterPick,
        lineSpecs: [menuSpec],
        lineKey: 'line-a',
        personName: 'Joao',
        unitDen: 3,
      }),
      null,
    );
    const second = addMenuFractionShareToPerson({
      allocations: afterPick,
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      personName: 'Joao',
      unitDen: 4,
    });
    assert.ok(second);
  });

  it('two 1/4 units on one share keep unit 4 even though 2/4 reads as 1/2', () => {
    let allocations: Record<string, ByItemConsumerRow[]> = { 'line-a': emptyRows() };
    for (let i = 0; i < 2; i += 1) {
      const next = addMenuFractionShareToPerson({
        allocations,
        lineSpecs: [menuSpec],
        lineKey: 'line-a',
        personName: 'Ana',
        unitDen: 4,
      });
      assert.ok(next);
      allocations = next;
    }
    const row = allocations['line-a']!.find((r) => r.name === 'Ana')!;
    assert.equal(row.qtyNum, '1');
    assert.equal(row.qtyDen, '2');
    assert.equal(row.unitDen, 4);
  });

  it('a whole portion that overshoots into the remainder carries the line cut', () => {
    const spec: ByItemLineSpec = { ...menuSpec, lineQty: 1, lineTotal: 2.5 };
    const afterThird = addMenuFractionShareToPerson({
      allocations: { 'line-a': emptyRows() },
      lineSpecs: [spec],
      lineKey: 'line-a',
      personName: 'Ana',
      unitDen: 3,
    });
    assert.ok(afterThird);
    // Joao takes "1份" but only 2/3 is left → his 2/3 share is cut in thirds.
    const afterWhole = addWholeShareToPerson({
      allocations: afterThird,
      lineSpecs: [spec],
      lineKey: 'line-a',
      personName: 'Joao',
    });
    assert.ok(afterWhole);
    const joao = afterWhole['line-a']!.find((r) => r.name === 'Joao')!;
    assert.equal(joao.qtyNum, '2');
    assert.equal(joao.qtyDen, '3');
    assert.equal(joao.unitDen, 3);
  });
});

describe('returnMenuShareToPool / returnBuffetSeatToPool', () => {
  it('returns one whole and keeps the rest of the share', () => {
    const result = returnMenuShareToPool({
      allocations: {
        'line-a': [{ id: 'r', name: 'Ana', partyId: 'p', qtyWhole: '2', qtyNum: '', qtyDen: '' }],
      },
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'r',
      kind: 'whole',
    });
    assert.ok(result);
    assert.equal(result.removed, false);
    assert.equal(result.allocations['line-a']![0]!.qtyWhole, '1');
  });

  it('returns one 1/unit; a whole-number remainder carries no unit', () => {
    const result = returnMenuShareToPool({
      allocations: {
        'line-a': [{
          id: 'r',
          name: 'Ana',
          qtyWhole: '1',
          qtyNum: '1',
          qtyDen: '3',
          unitDen: 3,
        }],
      },
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'r',
      kind: 'fraction',
    });
    assert.ok(result);
    const row = result.allocations['line-a']![0]!;
    assert.equal(row.qtyWhole, '1');
    assert.equal(row.qtyNum, '');
    assert.equal(row.unitDen, undefined);
  });

  it('removes the row and reports the ticket when the last unit goes back', () => {
    const result = returnMenuShareToPool({
      allocations: {
        'line-a': [{ id: 'r', name: 'Ana', partyId: 'p-ana', qtyWhole: '1', qtyNum: '', qtyDen: '' }],
      },
      lineSpecs: [menuSpec],
      lineKey: 'line-a',
      rowId: 'r',
      kind: 'whole',
    });
    assert.ok(result);
    assert.equal(result.removed, true);
    assert.ok(result.ticketKey);
    assert.ok(!result.allocations['line-a']!.some((row) => row.name === 'Ana'));
  });

  it('refuses when the share holds less than the unit, or the row is paid', () => {
    const quarter: ByItemConsumerRow = {
      id: 'r',
      name: 'Ana',
      qtyWhole: '',
      qtyNum: '1',
      qtyDen: '3',
      unitDen: 3,
    };
    assert.equal(
      returnMenuShareToPool({
        allocations: { 'line-a': [quarter] },
        lineSpecs: [menuSpec],
        lineKey: 'line-a',
        rowId: 'r',
        kind: 'whole',
      }),
      null,
    );
    assert.equal(
      returnMenuShareToPool({
        allocations: { 'line-a': [{ ...quarter, paidLocked: true, lockedAmount: 0.8 }] },
        lineSpecs: [menuSpec],
        lineKey: 'line-a',
        rowId: 'r',
        kind: 'fraction',
      }),
      null,
    );
  });

  it('returns buffet heads one at a time and drops the row at zero', () => {
    const buffet: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf',
      lineTotal: 30,
      adults: 1,
      children: 1,
      adultUnitPrice: 20,
      childUnitPrice: 10,
    };
    const row: ByItemConsumerRow = {
      id: 'r',
      name: 'Ana',
      partyId: 'p',
      qtyWhole: '',
      qtyNum: '',
      qtyDen: '',
      adultQty: '1',
      childQty: '1',
    };
    const afterAdult = returnBuffetSeatToPool({
      allocations: { bf: [row] },
      lineSpecs: [buffet],
      lineKey: 'bf',
      rowId: 'r',
      guestType: 'adult',
    });
    assert.ok(afterAdult);
    assert.equal(afterAdult.removed, false);
    assert.equal(afterAdult.allocations.bf![0]!.adultQty, '');
    assert.equal(afterAdult.allocations.bf![0]!.childQty, '1');

    const afterChild = returnBuffetSeatToPool({
      allocations: afterAdult.allocations,
      lineSpecs: [buffet],
      lineKey: 'bf',
      rowId: 'r',
      guestType: 'child',
    });
    assert.ok(afterChild);
    assert.equal(afterChild.removed, true);

    assert.equal(
      returnBuffetSeatToPool({
        allocations: afterAdult.allocations,
        lineSpecs: [buffet],
        lineKey: 'bf',
        rowId: 'r',
        guestType: 'adult',
      }),
      null,
    );
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

describe('staffByItemBuffetShareLineMetaParts', () => {
  it('shows gold amount when ready and — when not', () => {
    assert.deepEqual(
      staffByItemBuffetShareLineMetaParts({
        amount: 89.8,
        amountReady: true,
      }),
      { amountText: '€89.80', amountReady: true },
    );
    assert.deepEqual(
      staffByItemBuffetShareLineMetaParts({
        amount: 0,
        amountReady: false,
      }),
      { amountText: '—', amountReady: false },
    );
  });

  it('person shares use pool unitPriceLabel on buffet, never qty× algebra', () => {
    const buffetSpec: ByItemLineSpec = {
      mode: 'buffet',
      key: 'bf-1',
      lineTotal: 29.95,
      adults: 1,
      children: 1,
      adultUnitPrice: 19.95,
      childUnitPrice: 10,
    };
    const buffetLine = {
      key: 'bf-1',
      name: 'Buffet livre',
      name_zh: 'Buffet livre',
      name_en: 'Buffet livre',
      name_pt: 'Buffet livre',
      quantity: 1,
      unit_price: 29.95,
      adult_count: 1,
      child_count: 1,
      adult_unit_price: 19.95,
      child_unit_price: 10,
    };
    const allocations = {
      'bf-1': [
        {
          id: 'r1',
          name: 'Ana',
          qtyWhole: '',
          qtyNum: '',
          qtyDen: '',
          adultQty: '1',
          childQty: '1',
        },
      ] satisfies ByItemConsumerRow[],
    };
    const shares = staffByItemPersonShares({
      personName: 'Ana',
      lineSpecs: [buffetSpec],
      orderLines: [buffetLine],
      allocations,
      lang: 'zh',
    });
    assert.equal(shares.length, 1);
    assert.equal(shares[0]!.mode, 'buffet');
    assert.equal(shares[0]!.unitPriceLabel, '€19.95/A · €10.00/C');
    assert.equal(shares[0]!.qtyLabel, '');
    assert.equal(shares[0]!.amount, 29.95);
  });
});
