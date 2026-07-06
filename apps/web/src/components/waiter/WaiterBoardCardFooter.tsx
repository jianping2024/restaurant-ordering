'use client';

import {
  WaiterBoardOrderIcon,
  WaiterClockIcon,
  WaiterPlusCircleIcon,
} from '@/components/waiter/waiter-table-detail-icons';
import type { WaiterBoardCardFooterIcon } from '@/lib/waiter-board-card-display';

const FOOTER_BASE =
  'inline-flex w-full items-center justify-center gap-1.5 rounded-lg border bg-transparent px-3.5 py-2 text-sm font-semibold transition-colors';

type Props = {
  label: string;
  icon: WaiterBoardCardFooterIcon;
  footerClassName: string;
  disabled?: boolean;
};

function FooterIcon({ icon }: { icon: WaiterBoardCardFooterIcon }) {
  const className = 'h-4 w-4 shrink-0';
  if (icon === 'open_table') return <WaiterPlusCircleIcon className={className} />;
  if (icon === 'checkout') return <WaiterClockIcon className={className} />;
  return <WaiterBoardOrderIcon className={className} />;
}

/** Visual footer inside a whole-card link/button — not a separate control. */
export function WaiterBoardCardFooter({
  label,
  icon,
  footerClassName,
  disabled = false,
}: Props) {
  return (
    <div className="mt-3">
      <span
        aria-hidden
        className={`${FOOTER_BASE} ${footerClassName} ${disabled ? 'opacity-55' : ''}`}
      >
        <FooterIcon icon={icon} />
        {label}
      </span>
    </div>
  );
}
