import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stationTicketAlreadyEnqueuedForBatch } from './station-ticket-enqueue-dedupe';

describe('stationTicketAlreadyEnqueuedForBatch', () => {
  const orderId = 'ord-1';
  const batchId = 'batch-1';
  const stationId = 'st-1';

  it('is false when no jobs', () => {
    assert.equal(
      stationTicketAlreadyEnqueuedForBatch([], orderId, batchId, stationId),
      false,
    );
  });

  it('matches done jobs (replay must not insert a second slip)', () => {
    assert.equal(
      stationTicketAlreadyEnqueuedForBatch(
        [
          {
            payload: {
              order_id: orderId,
              batch_id: batchId,
              print_station_id: stationId,
            },
          },
        ],
        orderId,
        batchId,
        stationId,
      ),
      true,
    );
  });

  it('ignores other batch or station', () => {
    assert.equal(
      stationTicketAlreadyEnqueuedForBatch(
        [
          {
            payload: {
              order_id: orderId,
              batch_id: 'other-batch',
              print_station_id: stationId,
            },
          },
          {
            payload: {
              order_id: orderId,
              batch_id: batchId,
              print_station_id: 'other-st',
            },
          },
        ],
        orderId,
        batchId,
        stationId,
      ),
      false,
    );
  });
});
