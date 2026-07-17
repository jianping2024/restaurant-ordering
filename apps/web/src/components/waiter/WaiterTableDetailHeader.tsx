import { WaiterClockIcon } from '@/components/waiter/waiter-table-detail-icons';
import { waiterDetailLayout } from '@/components/waiter/waiter-table-detail-ui';

type Props = {
  heading: string;
  updatedAtLabel?: string | null;
};

export function WaiterTableDetailHeader({
  heading,
  updatedAtLabel = null,
}: Props) {
  return (
    <div className={waiterDetailLayout.pageHeading}>
      <div className={waiterDetailLayout.pageHeadingRow}>
        <h1 className={waiterDetailLayout.pageHeadingTitle}>{heading}</h1>
        {updatedAtLabel != null ? (
          <span className={waiterDetailLayout.pageHeadingMeta}>
            <WaiterClockIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {updatedAtLabel}
          </span>
        ) : null}
      </div>
    </div>
  );
}
