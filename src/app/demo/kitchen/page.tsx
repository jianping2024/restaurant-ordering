import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { DEMO_ORDERS, DEMO_RESTAURANT } from '@/lib/demo-data';

export const metadata = {
  title: 'Mesa Demo Kitchen',
};

export default function DemoKitchenPage() {
  return (
    <KitchenDisplay
      restaurant={DEMO_RESTAURANT}
      initialOrders={DEMO_ORDERS.filter((order) => order.status !== 'done')}
      isDemo
    />
  );
}
