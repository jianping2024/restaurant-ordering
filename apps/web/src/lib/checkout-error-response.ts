import { NextResponse } from 'next/server';
import { checkoutErrorStatus, type CheckoutErrorCode } from '@/lib/checkout-error-codes';

/** Sole JSON error response for checkout routes: status comes from the registry, never inline. */
export function checkoutErrorResponse(code: CheckoutErrorCode, extra?: { message?: string }) {
  return NextResponse.json(
    { error: code, ...(extra?.message !== undefined ? { message: extra.message } : {}) },
    { status: checkoutErrorStatus(code) },
  );
}
