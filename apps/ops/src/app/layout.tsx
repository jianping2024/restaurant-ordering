import type { Metadata } from 'next';
import { OPS_CONSOLE_NAME, PRODUCT_NAME } from '@mesa/shared';
import './globals.css';

export const metadata: Metadata = {
  title: OPS_CONSOLE_NAME,
  description: `${PRODUCT_NAME} platform operations console`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
