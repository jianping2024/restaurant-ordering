import { Suspense } from 'react';
import RestaurantsListPage from './RestaurantsListClient';

export default function RestaurantsPage() {
  return (
    <Suspense fallback={<p className="text-zinc-500">加载中…</p>}>
      <RestaurantsListPage />
    </Suspense>
  );
}
