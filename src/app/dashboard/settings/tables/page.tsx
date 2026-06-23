import { redirect } from 'next/navigation';

export default function SettingsTablesPageRedirect() {
  redirect('/dashboard/tables');
}
