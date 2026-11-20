import { DashboardEntry, dashboardEntrySearch } from '@/components/dashboard/DashboardEntry';

export default function DashboardEntryPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return <DashboardEntry page="" search={dashboardEntrySearch(searchParams)} />;
}
