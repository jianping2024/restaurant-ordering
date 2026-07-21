import { showToast } from '@/components/ui/Toast';

/** Query flag: waiter table detail runs staff-assisted return reconcile on entry. */
export const MENU_SUBMIT_RETURN_QUERY = 'menu_submit';

export function staffReturnHrefAfterMenuSubmit(returnHref: string): string {
  const [path, search = ''] = returnHref.split('?');
  const params = new URLSearchParams(search);
  params.set('from', MENU_SUBMIT_RETURN_QUERY);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : `${path}?from=${MENU_SUBMIT_RETURN_QUERY}`;
}

/** Guest menu: stay on page — toast; cart already cleared by caller path. */
export function completeGuestOrderSubmit(params: {
  orderSuccessMessage: string;
  clearCart: () => void;
}): void {
  params.clearCart();
  showToast(params.orderSuccessMessage, 'success');
}

/** Staff-assisted menu: navigate back; table detail owns fresh reconcile on entry. */
export function completeStaffAssistedOrderSubmit(params: {
  returnHref: string;
  clearCart: () => void;
  navigate: (href: string) => void;
}): void {
  params.clearCart();
  params.navigate(staffReturnHrefAfterMenuSubmit(params.returnHref));
}

/** Staff overlay on table detail — stay on page; caller patches orders + closes shell. */
export function completeStaffOverlayOrderSubmit(params: {
  clearCart: () => void;
}): void {
  params.clearCart();
}
