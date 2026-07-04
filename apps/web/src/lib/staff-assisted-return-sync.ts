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
 * Freshness contract on table detail: SSR refresh (current route) + one staff API reconcile.
 * Caller strips the query param after reconcile completes.
 */
export async function reconcileStaffAssistedMenuSubmitReturn(params: {
  router: TableDetailRouter;
  pathname: string;
  refreshDetail: () => Promise<unknown>;
}): Promise<void> {
  params.router.refresh();
  await params.refreshDetail();
  params.router.replace(params.pathname);
}
