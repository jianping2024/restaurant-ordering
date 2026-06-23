import { Suspense } from 'react';
import { PrintSubNav } from '@/components/PrintSubNav';
import PrintPairingsClient from './PrintPairingsClient';

export default function PrintPairingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">打印与支持</h1>
      <p className="mt-2 text-sm text-zinc-400">跨店查看并吊销未消费的活跃配对码</p>
      <div className="mt-6">
        <PrintSubNav />
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintPairingsClient />
        </Suspense>
      </div>
    </div>
  );
}
