import { demoPageMetadata } from '@/lib/demo-page-metadata';
import { DemoHubPageClient } from '@/components/demo/DemoHubPageClient';

export const metadata = demoPageMetadata('Demo Hub');

export default function DemoHubPage() {
  return <DemoHubPageClient />;
}
