/** UI handling for POST close-table-session / waiter sessions close responses. */

export type CloseTableSessionApiBody = {
  error?: string;
  ok?: boolean;
};

export type CloseTableSessionUiAction =
  | { action: 'success' }
  | { action: 'confirm_close' }
  | { action: 'no_session' }
  | { action: 'error' };

export function interpretCloseTableSessionResponse(
  status: number,
  body: CloseTableSessionApiBody = {},
): CloseTableSessionUiAction {
  if (status === 200 && body.ok !== false) {
    return { action: 'success' };
  }
  if (status === 404 || body.error === 'no_session') {
    return { action: 'no_session' };
  }
  if (
    status === 409 &&
    (body.error === 'close_confirm_required' || body.error === 'checkout_confirm_required')
  ) {
    return { action: 'confirm_close' };
  }
  return { action: 'error' };
}

export function parseCloseConfirmFromBody(body: {
  confirm_close?: unknown;
  confirm_checkout_close?: unknown;
}): boolean {
  return body.confirm_close === true || body.confirm_checkout_close === true;
}
