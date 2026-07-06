import Link from 'next/link';
import { WaiterClockIcon } from '@/components/waiter/waiter-table-detail-icons';
import { waiterUi } from '@/components/waiter/waiter-ui';

type Props = {
  boardHref: string;
  backLabel: string;
  heading: string;
  updatedAtLabel?: string | null;
};

export function WaiterTableDetailHeader({
  boardHref,
  backLabel,
  heading,
  updatedAtLabel = null,
}: Props) {
  return (
    <div className="mb-6">
      <div className="mb-3">
        <Link href={boardHref} className={waiterUi.navLink}>
          ← {backLabel}
        </Link>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="font-heading text-2xl sm:text-3xl text-brand-gold">{heading}</h1>
        {updatedAtLabel != null ? (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-brand-text-muted tabular-nums">
            <WaiterClockIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {updatedAtLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
