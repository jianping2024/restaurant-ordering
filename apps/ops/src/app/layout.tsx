import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mesa Ops',
  description: 'Mesa platform operations console',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
