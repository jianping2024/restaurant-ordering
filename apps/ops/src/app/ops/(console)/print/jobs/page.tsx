import { Suspense } from 'react';
import { PrintSubNav } from '@/components/PrintSubNav';
import PrintJobsClient from './PrintJobsClient';

export default function PrintJobsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">打印与支持</h1>
      <p className="mt-2 text-sm text-zinc-400">跨店只读排障 print_jobs（不含 payload）</p>
      <div className="mt-6">
        <PrintSubNav />
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintJobsClient />
        </Suspense>
      </div>
    </div>
  );
}
