/** Match keys for one auto station_ticket slip (order batch × print station). */
function stationTicketPayloadMatch(
  p: Record<string, unknown>,
  orderId: string,
  batchId: string,
  printStationId: string,
): boolean {
  return (
    p.order_id === orderId &&
    p.batch_id === batchId &&
    p.print_station_id === printStationId
  );
}

/**
 * True when this order/batch/station already has any station_ticket (any status).
 * Replay finalize must not insert a second slip after the first job is already done.
 */
export function stationTicketAlreadyEnqueuedForBatch(
  jobs: Array<{ payload: unknown }>,
  orderId: string,
  batchId: string,
  printStationId: string,
): boolean {
  return jobs.some((j) => {
    const p = j.payload;
    if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
    return stationTicketPayloadMatch(
      p as Record<string, unknown>,
      orderId,
      batchId,
      printStationId,
    );
  });
}
