'use client';

/**
 * Sole path-back「取消」control for staff checkout detail footer
 * (exit to table detail — wired by Host).
 */
export function CheckoutPathChooserBackButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="text-sm font-semibold px-4 py-2 rounded-lg border border-brand-border text-brand-text hover:bg-brand-border/30 disabled:opacity-50 transition-colors"
    >
      {props.label}
    </button>
  );
}
