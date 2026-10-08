import { logJsonConsoleEvent } from '@/lib/json-console-log';

/**
 * Sole structured log for staff「恢复点单」failures.
 * Channel/event are fixed: `[checkout_resume] {"event":"resume_failed",…}`.
 * Server route + browser hook + prepare gate all call this — never a second console shape.
 */
export type CheckoutResumeFailureLogFields = {
  /** Where the failure was observed. */
  stage: 'api' | 'client' | 'prepare';
  error: string;
  slug?: string;
  restaurant_id?: string;
  table_id?: string;
  session_id?: string;
  operator_name?: string;
  status?: number;
  message?: string;
};

export function logCheckoutResumeFailure(fields: CheckoutResumeFailureLogFields): void {
  logJsonConsoleEvent('checkout_resume', 'resume_failed', fields);
}
