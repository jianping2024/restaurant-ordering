import type { MutationError } from '@/lib/dashboard-api-shared';
import {
  dashboardApiError,
  loadWritableOperationalContext,
  readJsonBody,
} from '@/lib/dashboard-api-shared';

export type MenuMutationError = MutationError;

export function menuApiError(result: MenuMutationError) {
  return dashboardApiError(result);
}

export { readJsonBody, loadWritableOperationalContext };
