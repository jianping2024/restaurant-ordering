/** Sole gate for guest menu table Realtime (开台 discovery + submitted sync). */
export function customerTableSessionRealtimeEnabled(params: {
  isDemo?: boolean;
  staffAssisted: unknown;
  sessionResolved: boolean;
  tableId: string | null | undefined;
}): boolean {
  return (
    !params.isDemo &&
    params.staffAssisted == null &&
    params.sessionResolved &&
    Boolean(params.tableId)
  );
}
