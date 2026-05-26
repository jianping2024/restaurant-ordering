import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { DEMO_ORDERS, DEMO_RESTAURANT, DEMO_TABLES } from '@/lib/demo-data';

export const metadata = {
  title: 'Mesa Demo Waiter',
};

export default function DemoWaiterPage() {
  return (
    <WaiterDisplay
      restaurant={DEMO_RESTAURANT}
      tables={DEMO_TABLES}
      initialOrders={DEMO_ORDERS}
      isDemo
    />
  );
}
