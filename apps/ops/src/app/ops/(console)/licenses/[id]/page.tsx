import { LicenseDetailClient } from './LicenseDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function LicenseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <LicenseDetailClient restaurantId={id} />;
}
