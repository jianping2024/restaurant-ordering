import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { StaffLoginForm } from '@/components/staff/StaffLoginForm';

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
    <StaffLoginForm
      mode="store"
      slug={restaurant.slug as string}
      restaurantName={restaurant.name as string}
    />
  );
}
