import { redirect } from 'next/navigation';

export default function LegacySettingsMenuPage() {
  redirect('/dashboard/settings');
}
