import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';
import type { StaffRole } from '@/lib/staff-account';

/** Roles shown in sticky product top bars (dashboard + staff shells). */
export type TopBarActorRole = 'owner' | StaffRole;

export function topBarRoleLabel(lang: UILanguage, role: TopBarActorRole): string {
  const t = getMessages(lang).staffSettings;
  switch (role) {
    case 'owner':
      return t.roleOwner;
    case 'kitchen':
      return t.roleKitchen;
    case 'waiter':
      return t.roleWaiter;
    case 'cashier':
      return t.roleCashier;
    case 'frontdesk':
      return t.roleFrontdesk;
  }
}
