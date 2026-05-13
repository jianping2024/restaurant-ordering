import { redirect } from 'next/navigation';

export default function LegacyMenuPage() {
  redirect('/dashboard/settings/menu');
}
