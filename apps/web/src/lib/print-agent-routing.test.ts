import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterPrintJobsForDevice,
  isPrintJobVisibleToDevice,
  normalizeStationPrintersInput,
  parseReceiptStationId,
  printJobTargetStationId,
  stationIdsFromRoutingSnapshot,
} from '@/lib/print-agent-routing';

const kitchenId = '11111111-1111-1111-1111-111111111111';
const barId = '22222222-2222-2222-2222-222222222222';

const kitchenSnapshot = {
  receipt_printers: [{ id: `station:${kitchenId}`, label: 'Kitchen', role: 'station' as const }],
  updated_at: '2026-06-27T12:00:00.000Z',
};

describe('stationIdsFromRoutingSnapshot', () => {
  it('parses station ids from receipt_printers', () => {
    const ids = stationIdsFromRoutingSnapshot(kitchenSnapshot);
    assert.equal(ids.size, 1);
    assert.equal(ids.has(kitchenId), true);
  });
});

describe('printJobTargetStationId', () => {
  it('reads station_ticket print_station_id', () => {
    assert.equal(
      printJobTargetStationId({
        type: 'station_ticket',
        payload: { print_station_id: kitchenId },
      }),
      kitchenId,
    );
  });

  it('reads receipt station from receipt_printer_id', () => {
    assert.equal(
      printJobTargetStationId({
        type: 'order_receipt',
        payload: { receipt_printer_id: `station:${barId}` },
      }),
      barId,
    );
  });
});

describe('isPrintJobVisibleToDevice', () => {
  const kitchenOnly = stationIdsFromRoutingSnapshot(kitchenSnapshot);

  it('shows station_ticket only for mapped station', () => {
    assert.equal(
      isPrintJobVisibleToDevice(
        { type: 'station_ticket', payload: { print_station_id: kitchenId } },
        kitchenOnly,
      ),
      true,
    );
    assert.equal(
      isPrintJobVisibleToDevice(
        { type: 'station_ticket', payload: { print_station_id: barId } },
        kitchenOnly,
      ),
      false,
    );
  });

  it('shows receipt for mapped station only when explicit', () => {
    assert.equal(
      isPrintJobVisibleToDevice(
        { type: 'order_receipt', payload: { receipt_printer_id: `station:${kitchenId}` } },
        kitchenOnly,
      ),
      true,
    );
    assert.equal(
      isPrintJobVisibleToDevice(
        { type: 'order_receipt', payload: { receipt_printer_id: `station:${barId}` } },
        kitchenOnly,
      ),
      false,
    );
  });

  it('shows fallback receipt to any configured device', () => {
    assert.equal(
      isPrintJobVisibleToDevice({ type: 'order_receipt', payload: {} }, kitchenOnly),
      true,
    );
  });

  it('shows nothing when device has no mapped stations', () => {
    assert.equal(
      isPrintJobVisibleToDevice(
        { type: 'station_ticket', payload: { print_station_id: kitchenId } },
        new Set(),
      ),
      false,
    );
  });
});

describe('filterPrintJobsForDevice', () => {
  it('filters mixed jobs for kitchen device', () => {
    const kitchenOnly = stationIdsFromRoutingSnapshot(kitchenSnapshot);
    const jobs = [
      { id: '1', type: 'station_ticket', payload: { print_station_id: kitchenId } },
      { id: '2', type: 'station_ticket', payload: { print_station_id: barId } },
      { id: '3', type: 'order_receipt', payload: { receipt_printer_id: `station:${kitchenId}` } },
    ];
    const filtered = filterPrintJobsForDevice(jobs, kitchenOnly);
    assert.deepEqual(filtered.map((j) => j.id), ['1', '3']);
  });
});

describe('parseReceiptStationId', () => {
  it('parses station prefix', () => {
    assert.equal(parseReceiptStationId(`station:${kitchenId}`), kitchenId);
    assert.equal(parseReceiptStationId('cashier'), null);
  });
});

describe('normalizeStationPrintersInput', () => {
  it('trims and drops empty entries', () => {
    assert.deepEqual(
      normalizeStationPrintersInput({
        [` ${kitchenId} `]: ' tcp:1.2.3.4:9100 ',
        '': 'x',
        bad: '',
      }),
      { [kitchenId]: 'tcp:1.2.3.4:9100' },
    );
  });
});
