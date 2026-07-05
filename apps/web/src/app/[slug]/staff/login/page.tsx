import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { StoreStaffLoginClient } from '@/components/auth/StoreStaffLoginClient';

export default async function StoreStaffLoginPage({ params }: { params: { slug: string } }) {
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    notFound();
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name, slug')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!restaurant) notFound();

  return (
    <StoreStaffLoginClient
      storeSlug={restaurant.slug as string}
      restaurantName={restaurant.name as string}
    />
  );
}
