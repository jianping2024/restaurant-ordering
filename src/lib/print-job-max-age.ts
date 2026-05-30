/** Max age for print_jobs the agent may claim (station tickets and receipts). */
export const PRINT_JOB_MAX_AGE_MS = 20 * 60 * 1000;

/** Max time a job may stay in processing without a status update before server voids it. */
export const PRINT_JOB_PROCESSING_STALE_MS = 5 * 60 * 1000;

export const PRINT_JOB_EXPIRED_ERROR_MESSAGE =
  'Print job expired (older than 20 minutes); not printed';

export const PRINT_JOB_PROCESSING_STALE_ERROR_MESSAGE =
  'Print job timed out in processing (server auto-cancelled); verify printer or retry';

export function printJobMaxAgeCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRINT_JOB_MAX_AGE_MS);
}

export function printJobMaxAgeCutoffIso(now: Date = new Date()): string {
  return printJobMaxAgeCutoffDate(now).toISOString();
}

export function printJobProcessingStaleCutoffDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - PRINT_JOB_PROCESSING_STALE_MS);
}

export function printJobProcessingStaleCutoffIso(now: Date = new Date()): string {
  return printJobProcessingStaleCutoffDate(now).toISOString();
}
