/** Max age for print_jobs the agent may claim (station tickets and receipts). */
export const PRINT_JOB_MAX_AGE_MS = 10 * 60 * 1000;

export const PRINT_JOB_EXPIRED_ERROR_MESSAGE =
  'Print job expired (older than 10 minutes); not printed';

export function printJobMaxAgeCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRINT_JOB_MAX_AGE_MS);
}

export function printJobMaxAgeCutoffIso(now: Date = new Date()): string {
  return printJobMaxAgeCutoffDate(now).toISOString();
}
