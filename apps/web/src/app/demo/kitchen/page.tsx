import { KitchenScreenBoard } from '@/components/kitchen/KitchenScreenBoard';
import {
  DEMO_KITCHEN_SCREEN,
  DEMO_ORDERS,
  DEMO_PRINT_STATIONS,
  DEMO_RESTAURANT,
} from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { capabilitiesFromKeys } from '@/lib/permissions/can';

export const metadata = demoPageMetadata('Demo Kitchen');

export default function DemoKitchenPage() {
  return (
    <KitchenScreenBoard
      restaurant={DEMO_RESTAURANT}
      capabilities={toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.kitchen]))}
      screen={DEMO_KITCHEN_SCREEN}
      stations={DEMO_PRINT_STATIONS}
      initialOrders={DEMO_ORDERS.filter((order) => order.status !== 'done')}
      isDemo
    />
  );
}
