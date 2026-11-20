import { DashboardEntry, dashboardEntrySearch } from '@/components/dashboard/DashboardEntry';

/** Legacy store-less `/dashboard/<page>` bookmark → same page of the account's store. */
export default function LegacyDashboardPage({
  params,
  searchParams,
}: {
  params: { page: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // `/dashboard/r` without a slug is not a page — land on the store overview.
  const segments = params.page[0] === 'r' ? [] : params.page;
  const page = segments.length ? `/${segments.map(encodeURIComponent).join('/')}` : '';
  return <DashboardEntry page={page} search={dashboardEntrySearch(searchParams)} />;
}
