import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { RestaurantDetailTabs } from '@/components/RestaurantDetailTabs';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

export default async function RestaurantDetailLayout({ children, params }: LayoutProps) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: row } = await admin.from('restaurants').select('id, name').eq('id', id).maybeSingle();

  if (!row) notFound();

  return (
    <div>
      <RestaurantDetailTabs restaurantId={row.id} restaurantName={row.name} />
      {children}
    </div>
  );
}
