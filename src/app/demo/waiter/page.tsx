import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { DEMO_ORDERS, DEMO_RESTAURANT, DEMO_TABLE_NUMBERS } from '@/lib/demo-data';

export const metadata = {
  title: 'Mesa Demo Waiter',
};

export default function DemoWaiterPage() {
  return (
    <WaiterDisplay
      restaurant={DEMO_RESTAURANT}
      tableNumbers={DEMO_TABLE_NUMBERS}
      initialOrders={DEMO_ORDERS}
      isDemo
    />
  );
}
