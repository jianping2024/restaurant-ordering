import Link from 'next/link';
import { CustomerOrderedBagIcon } from '@/components/menu/customer-ordering-icons';

type Props = {
  title: string;
  viewBillHref: string;
  viewBillLabel: string;
  viewBillEnabled: boolean;
  showViewBillLink: boolean;
};

const viewBillLinkClassName =
  'shrink-0 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-3 py-1 text-[13px] font-medium text-brand-gold transition-colors hover:bg-brand-gold/15';

export function CustomerOrderedSectionHeader({
  title,
  viewBillHref,
  viewBillLabel,
  viewBillEnabled,
  showViewBillLink,
}: Props) {
  return (
    <div className="mb-1 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <CustomerOrderedBagIcon className="h-[18px] w-[18px] shrink-0 text-brand-gold" />
        <h2 className="truncate text-base font-medium text-brand-text">{title}</h2>
      </div>
      {showViewBillLink ? (
        viewBillEnabled ? (
          <Link href={viewBillHref} className={viewBillLinkClassName}>
            {viewBillLabel}
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${viewBillLinkClassName} pointer-events-none opacity-50`}
          >
            {viewBillLabel}
          </span>
        )
      ) : null}
    </div>
  );
}
