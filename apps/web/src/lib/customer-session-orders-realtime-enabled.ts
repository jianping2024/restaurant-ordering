/** Sole gate for customer session orders Realtime (classic menu + sushi submitted sync). */
export function customerSessionOrdersRealtimeEnabled(params: {
  isDemo?: boolean;
  staffAssisted: unknown;
  sessionResolved: boolean;
  sessionStatus: string | null | undefined;
  sessionId: string | null | undefined;
}): boolean {
  return (
    !params.isDemo &&
    params.staffAssisted == null &&
    params.sessionResolved &&
    params.sessionStatus === 'open' &&
    Boolean(params.sessionId)
  );
}
