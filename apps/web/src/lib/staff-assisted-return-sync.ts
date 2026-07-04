import { MENU_SUBMIT_RETURN_QUERY } from '@/lib/menu-order-submit-outcome';

type TableDetailRouter = {
  refresh: () => void;
  replace: (href: string) => void;
};

/** Table detail entry after staff-assisted menu submit (`?from=menu_submit`). */
export function isStaffAssistedMenuSubmitReturn(
  searchParams: Pick<URLSearchParams, 'get'>,
): boolean {
  return searchParams.get('from') === MENU_SUBMIT_RETURN_QUERY;
}

/**
 * Post-mutation freshness on table detail after staff-assisted menu submit.
 * Append just wrote orders; SSR/prefetch may be stale — one Staff API reconcile, then strip query.
 */
export async function reconcileStaffAssistedMenuSubmitReturn(params: {
  router: TableDetailRouter;
  pathname: string;
  refreshDetail: () => Promise<unknown>;
}): Promise<void> {
  await params.refreshDetail();
  params.router.replace(params.pathname);
}
