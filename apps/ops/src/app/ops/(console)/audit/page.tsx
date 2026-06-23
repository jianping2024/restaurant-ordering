import { Suspense } from 'react';
import AuditLogClient from './AuditLogClient';

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
      <AuditLogClient />
    </Suspense>
  );
}
