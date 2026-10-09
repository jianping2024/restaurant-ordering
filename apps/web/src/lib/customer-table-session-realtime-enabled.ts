/** Sole gate for guest table Realtime on menu + bill (开台 / orders / headcount sync). */
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
