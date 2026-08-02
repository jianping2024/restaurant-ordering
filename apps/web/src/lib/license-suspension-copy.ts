import {
  licenseSuspensionAction,
  licenseSuspensionCtaHref,
  type LicenseSuspensionAction,
} from '@mesa/shared';
import type { UILanguage } from '@/lib/i18n';
import { getMessages } from '@/lib/i18n/messages';

export type LicenseSuspensionCopy = {
  action: LicenseSuspensionAction;
  title: string;
  body: string;
  ctaLabel: string;
  ctaHref: '/setup' | null;
};

/** Sole UI copy mapper for suspension_reason (login + dashboard banner). */
export function licenseSuspensionCopy(
  lang: UILanguage,
  reason: string | null | undefined,
): LicenseSuspensionCopy {
  const action = licenseSuspensionAction(reason);
  const block = getMessages(lang).licenseSuspension[action];
  return {
    action,
    title: block.title,
    body: block.body,
    ctaLabel: block.ctaLabel,
    ctaHref: licenseSuspensionCtaHref(action),
  };
}
