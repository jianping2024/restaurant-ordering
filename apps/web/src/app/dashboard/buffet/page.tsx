import { redirect } from 'next/navigation';

export default function LegacyBuffetPage() {
  redirect('/dashboard/settings/buffet');
}
