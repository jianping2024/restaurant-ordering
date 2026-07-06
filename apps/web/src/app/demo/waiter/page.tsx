import { WaiterDisplay } from '@/components/waiter/WaiterDisplay';
import { DEMO_ORDERS, DEMO_OPEN_TABLE_DEFAULTS, DEMO_RESTAURANT, DEMO_TABLES } from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';

export const metadata = demoPageMetadata('Demo Waiter');

export default function DemoWaiterPage() {
  return (
    <WaiterDisplay
      restaurant={DEMO_RESTAURANT}
      tables={DEMO_TABLES}
      initialOrders={DEMO_ORDERS}
      isDemo
      initialOpenTableDefaults={DEMO_OPEN_TABLE_DEFAULTS}
    />
  );
}
