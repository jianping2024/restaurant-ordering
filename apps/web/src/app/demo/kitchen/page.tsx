import { KitchenDisplay } from '@/components/kitchen/KitchenDisplay';
import { DEMO_ORDERS, DEMO_RESTAURANT } from '@/lib/demo-data';
import { demoPageMetadata } from '@/lib/demo-page-metadata';
import { ROLE_TEMPLATES } from '@/lib/permissions/role-templates';
import { toCapabilitiesPayload } from '@/lib/permissions/can';
import { capabilitiesFromKeys } from '@/lib/permissions/can';

export const metadata = demoPageMetadata('Demo Kitchen');

export default function DemoKitchenPage() {
  return (
    <KitchenDisplay
      restaurant={DEMO_RESTAURANT}
      capabilities={toCapabilitiesPayload(capabilitiesFromKeys([...ROLE_TEMPLATES.kitchen]))}
      initialOrders={DEMO_ORDERS.filter((order) => order.status !== 'done')}
      isDemo
    />
  );
}
