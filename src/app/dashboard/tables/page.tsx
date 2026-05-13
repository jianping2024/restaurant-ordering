import { redirect } from 'next/navigation';

export default function TablesPageRedirect() {
  redirect('/dashboard/settings/tables');
}
