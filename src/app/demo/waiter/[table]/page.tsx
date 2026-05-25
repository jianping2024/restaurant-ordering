import { notFound } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { DEMO_ORDERS, DEMO_RESTAURANT, DEMO_TABLE_NUMBERS } from '@/lib/demo-data';
import {
  isValidTableNumberValue,
  restaurantHasTableNumber,
} from '@/lib/restaurant-table-numbers';

interface Props {
  params: Promise<{ table: string }>;
}

export const metadata = {
  title: 'Mesa Demo Waiter — Table',
};

export default async function DemoWaiterTablePage({ params }: Props) {
  const { table } = await params;
  const tableNum = Number(table);
  if (!isValidTableNumberValue(tableNum) || !restaurantHasTableNumber(tableNum, DEMO_TABLE_NUMBERS)) {
    notFound();
  }

  return (
    <WaiterTableDetail
      restaurant={{
        id: DEMO_RESTAURANT.id,
        name: DEMO_RESTAURANT.name,
        slug: DEMO_RESTAURANT.slug,
      }}
      tableNumbers={DEMO_TABLE_NUMBERS}
      initialOrders={DEMO_ORDERS}
      tableNumber={tableNum}
      isDemo
    />
  );
}
