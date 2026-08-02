import { Suspense } from 'react';
import RestaurantsListClient from './restaurants/RestaurantsListClient';

export default function OpsHomePage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
      <RestaurantsListClient />
    </Suspense>
  );
}
