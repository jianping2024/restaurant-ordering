import { RestaurantPrintPanel } from './RestaurantPrintPanel';

type PageProps = { params: Promise<{ id: string }> };

export default async function RestaurantPrintPage({ params }: PageProps) {
  const { id } = await params;
  return <RestaurantPrintPanel restaurantId={id} />;
}
