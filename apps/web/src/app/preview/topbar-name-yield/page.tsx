import type { Metadata } from 'next';
import { StaffTopbarNameYieldPreview } from '@/components/preview/StaffTopbarNameYieldPreview';

export const metadata: Metadata = {
  title: 'Preview · 顶栏店名让宽',
  robots: { index: false, follow: false },
};

export default function PreviewTopbarNameYieldPage() {
  return <StaffTopbarNameYieldPreview />;
}
