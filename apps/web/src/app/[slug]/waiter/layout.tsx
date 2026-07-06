import { notFound } from 'next/navigation';
import { WaiterStandaloneShell } from '@/components/waiter/WaiterStandaloneShell';
import { requireStaffSlugPageAccess } from '@/lib/staff-page-gate';
import { createClient } from '@/lib/supabase/server';

export default async function WaiterLayout({
  params,
  children,
}: {
  params: Promise<{ slug: string }>;
  children: React.ReactNode;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant } = await supabase
    .from('restaurants_public')
    .select('id, name, slug')
    .eq('slug', slug)
    .single();

  if (!restaurant) notFound();

  const access = await requireStaffSlugPageAccess(slug, ['waiter']);

  return (
    <WaiterStandaloneShell restaurant={restaurant} asOwner={access.as_owner}>
      {children}
    </WaiterStandaloneShell>
  );
}
