/** Mobile-safe customer form inputs — iOS Safari skips auto-zoom at >=16px. */
import { FORM_CONTROL_TEXT_CLASS } from '@/lib/form-control-text';

const customerInputCore =
  `${FORM_CONTROL_TEXT_CLASS} text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 tabular-nums`;

export const customerTextInputClass =
  `w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 ${customerInputCore} focus:ring-brand-gold/40`;

export const customerQtyInputClass =
  `bg-brand-bg border border-brand-border rounded-lg py-2 text-center ${customerInputCore} focus:ring-brand-gold/40`;

export const customerQtyInputAlertClass =
  `bg-brand-bg border border-red-500 rounded-lg py-2 text-center ${customerInputCore} focus:ring-red-500/40`;

export const customerInlineEditInputClass =
  `${FORM_CONTROL_TEXT_CLASS} text-brand-text bg-transparent border-b border-brand-gold/45 focus:outline-none min-w-[92px]`;

export const customerInlineAmountInputClass =
  `w-16 bg-transparent text-brand-gold font-medium ${FORM_CONTROL_TEXT_CLASS} text-right focus:outline-none tabular-nums`;

export const customerNifInputClass =
  `w-full rounded-xl border bg-brand-card px-3 py-2.5 ${FORM_CONTROL_TEXT_CLASS} text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-1`;
