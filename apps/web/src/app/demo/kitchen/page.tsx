import { KitchenScreenBoard } from '@/components/kitchen/KitchenScreenBoard';
import {
  DEMO_KITCHEN_SCREEN,
  DEMO_ORDERS,
  DEMO_PRINT_STATIONS,
  DEMO_RESTAURANT,
} from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';

export const metadata = demoPageMetadata('Demo Kitchen');

export default function DemoKitchenPage() {
  return (
    <KitchenScreenBoard
      restaurant={DEMO_RESTAURANT}
      screen={DEMO_KITCHEN_SCREEN}
      stations={DEMO_PRINT_STATIONS}
      initialOrders={DEMO_ORDERS.filter((order) => order.status !== 'done')}
      isDemo
    />
  );
}
