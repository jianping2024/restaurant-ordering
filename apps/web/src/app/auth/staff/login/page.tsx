import { redirect } from 'next/navigation';

export default function LegacyStaffLoginRedirect() {
  redirect('/auth/login');
}
