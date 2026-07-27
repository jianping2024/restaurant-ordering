import {
  formatOrderHistoryLifecycleStepLine,
  type OrderHistorySurfaceMeta,
} from '@/lib/order-history/build-lifecycle-presentation';
import { ORDER_HISTORY_OUTCOME_BADGE_CLASS } from '@/lib/order-history/build-detail-presentation';
import type { OrderHistoryLifecycleStep } from '@/lib/order-history/types';
import type { getMessages } from '@/lib/i18n/messages';

type OrderHistoryI18n = ReturnType<typeof getMessages>['orderHistory'];

type Props = {
  steps: OrderHistoryLifecycleStep[];
  i18n: OrderHistoryI18n;
  className?: string;
  stepClassName?: string;
};

export function orderHistoryLifecycleStepKey(step: OrderHistoryLifecycleStep): string {
  return `${step.kind}-${step.at}-${step.sortKey}`;
}

export function OrderHistoryLifecycleSteps({
  steps,
  i18n,
  className,
  stepClassName,
}: Props) {
  return (
    <div className={className}>
      {steps.map((step) => (
        <p key={orderHistoryLifecycleStepKey(step)} className={stepClassName}>
          {formatOrderHistoryLifecycleStepLine(step, i18n)}
        </p>
      ))}
    </div>
  );
}

type OutcomeBadgeProps = {
  badge: OrderHistorySurfaceMeta['outcomeBadge'];
  size?: 'sm' | 'md';
};

export function OrderHistoryOutcomeBadge({ badge, size = 'sm' }: OutcomeBadgeProps) {
  const padding = size === 'md' ? 'px-2 py-0.5' : 'px-1.5 py-0.5';
  return (
    <span
      className={`inline-flex text-[11px] ${padding} rounded-full border ${ORDER_HISTORY_OUTCOME_BADGE_CLASS[badge.tone]}`}
    >
      {badge.label}
    </span>
  );
}
