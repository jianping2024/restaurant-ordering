import { redirect } from 'next/navigation';

/** Legacy URL — print stations live under menu management. */
export default function SettingsPrintStationsPage() {
  redirect('/dashboard/settings/menu');
}
