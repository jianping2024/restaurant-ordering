import { notFound } from 'next/navigation';
import { WaiterTableDetail } from '@/components/waiter/WaiterTableDetail';
import { DEMO_ORDERS, DEMO_RESTAURANT } from '@/lib/demo-data';

interface Props {
  params: Promise<{ table: string }>;
}

export const metadata = {
  title: 'Mesa Demo Waiter — Table',
};

export default async function DemoWaiterTablePage({ params }: Props) {
  const { table } = await params;
  const tableNum = Number(table);
  if (!Number.isInteger(tableNum) || tableNum < 1 || tableNum > 30) notFound();

  return (
    <WaiterTableDetail
      restaurant={{
        id: DEMO_RESTAURANT.id,
        name: DEMO_RESTAURANT.name,
        slug: DEMO_RESTAURANT.slug,
      }}
      initialOrders={DEMO_ORDERS}
      tableNumber={tableNum}
      isDemo
    />
  );
}
