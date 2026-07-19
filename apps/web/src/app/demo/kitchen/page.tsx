import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { DEMO_ORDERS, DEMO_RESTAURANT } from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';
import { toKitchenBoardOrder } from '@/lib/kitchen-board-types';

export const metadata = demoPageMetadata('Demo Kitchen');

export default function DemoKitchenPage() {
  const initialOrders = DEMO_ORDERS.map(toKitchenBoardOrder).filter(
    (order): order is NonNullable<typeof order> => order != null,
  );
  return (
    <KitchenDisplay
      restaurant={DEMO_RESTAURANT}
      initialOrders={initialOrders}
      isDemo
    />
  );
}
