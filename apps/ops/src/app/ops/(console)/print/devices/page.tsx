import { Suspense } from 'react';
import { PrintSubNav } from '@/components/PrintSubNav';
import PrintDevicesClient from './PrintDevicesClient';

export default function PrintDevicesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">打印与支持</h1>
      <p className="mt-2 text-sm text-zinc-400">跨店查看打印代理设备、任务与配对码（P1）</p>
      <div className="mt-6">
        <PrintSubNav />
        <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
          <PrintDevicesClient />
        </Suspense>
      </div>
    </div>
  );
}
