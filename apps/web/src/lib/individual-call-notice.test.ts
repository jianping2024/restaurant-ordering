import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIndividualCallNoticePerson,
  formatIndividualCallNoticeEuro,
  mergeIndividualCallNoticePeople,
  pickIndividualCallNoticeSignals,
  resolveIndividualCallSignalItemName,
  type IndividualCheckoutSignal,
} from './individual-call-notice';

const NOW = Date.parse('2026-10-05T12:00:00Z');

function signal(partial: Partial<IndividualCheckoutSignal> & { id: string }): IndividualCheckoutSignal {
  return {
    kind: 'call',
    reason: 'call',
    ticket_key: `p:${partial.id}`,
    name: 'Wang',
    items: [],
    created_at: '2026-10-05T11:59:50Z',
    ...partial,
  };
}

describe('pickIndividualCallNoticeSignals', () => {
  it('keeps recent calls from others and drops silent, own and stale ones', () => {
    const picked = pickIndividualCallNoticeSignals({
      signals: [
        signal({ id: 'a' }),
        signal({ id: 'b', kind: 'silent', reason: 'unlock' }),
        signal({ id: 'c' }),
        signal({ id: 'd', created_at: '2026-10-05T11:50:00Z' }),
      ],
      ignoreTicketKeys: new Set(['p:c']),
      nowMs: NOW,
    });
    assert.deepEqual(picked.map((s) => s.id), ['a']);
  });
});

describe('buildIndividualCallNoticePerson', () => {
  it('lists claimed dishes with amounts from the signal stamp', () => {
    const person = buildIndividualCallNoticePerson(
      signal({
        id: 'a',
        name: 'Jack',
        items: [
          {
            key: 'L1',
            qty_num: 1,
            qty_den: 1,
            amount: 12.99,
            name_pt: 'Sumo',
            name_en: 'Juice',
            name_zh: '果汁',
          },
          {
            key: 'L2',
            qty_num: 1,
            qty_den: 2,
            amount: 9.5,
            name_pt: 'Sashimi',
            name_en: 'Sashimi',
            name_zh: '刺身',
          },
        ],
      }),
      'zh',
    );
    assert.equal(person?.name, 'Jack');
    assert.equal(person?.amount, 22.49);
    assert.deepEqual(
      person?.items.map((row) => [row.label, row.qtyLabel, row.amount]),
      [
        ['果汁', '×1', 12.99],
        ['刺身', '×1/2', 9.5],
      ],
    );
  });

  it('keeps a name-only block when legacy signals lack dish stamps', () => {
    const person = buildIndividualCallNoticePerson(signal({ id: 'a', name: 'Jack' }), 'zh');
    assert.deepEqual(person, {
      ticketKey: 'p:a',
      name: 'Jack',
      items: [],
      amount: 0,
    });
  });
});

describe('mergeIndividualCallNoticePeople', () => {
  it('appends a second ticket while the modal is open and never merges by name', () => {
    const first = mergeIndividualCallNoticePeople({
      existing: [],
      signals: [
        signal({
          id: '1',
          name: 'Jack',
          items: [
            {
              key: 'L1',
              qty_num: 1,
              qty_den: 1,
              amount: 3,
              name_pt: 'A',
              name_en: 'A',
              name_zh: 'A',
            },
          ],
        }),
      ],
      lang: 'zh',
    });
    const merged = mergeIndividualCallNoticePeople({
      existing: first,
      signals: [
        signal({
          id: '2',
          name: 'Jack',
          items: [
            {
              key: 'L2',
              qty_num: 1,
              qty_den: 1,
              amount: 4,
              name_pt: 'B',
              name_en: 'B',
              name_zh: 'B',
            },
          ],
        }),
      ],
      lang: 'zh',
    });
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((row) => row.ticketKey),
      ['p:1', 'p:2'],
    );
  });
});

describe('resolveIndividualCallSignalItemName', () => {
  it('picks UI language with PT then EN then ZH fallbacks', () => {
    assert.equal(
      resolveIndividualCallSignalItemName(
        { name_pt: 'Cha', name_en: 'Tea', name_zh: '茶' },
        'zh',
      ),
      '茶',
    );
    assert.equal(
      resolveIndividualCallSignalItemName({ name_pt: 'Cha', name_en: '', name_zh: '' }, 'en'),
      'Cha',
    );
  });
});

describe('formatIndividualCallNoticeEuro', () => {
  it('formats two decimal euros', () => {
    assert.equal(formatIndividualCallNoticeEuro(22.4), '€22.40');
  });
});
