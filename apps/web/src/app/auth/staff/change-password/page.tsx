import { StaffChangePasswordForm } from '@/components/auth/StaffChangePasswordForm';
import { requireStaffChangePasswordPage } from '@/lib/staff-change-password-gate';

export default async function StaffChangePasswordPage() {
  await requireStaffChangePasswordPage();
  return <StaffChangePasswordForm />;
}
