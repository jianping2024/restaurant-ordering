import type { Language } from '@/types';
import type { StaffAssistedFlow } from '@/lib/staff-routes';
import { isWaiterTableDetailReturnPath } from '@/lib/staff-routes';

export const STAFF_ASSISTED_MESSAGES: Record<
  Language,
  {
    backToTable: string;
    backToBoard: string;
  }
> = {
  pt: {
    backToTable: 'Voltar à mesa',
    backToBoard: 'Voltar ao painel',
  },
  en: {
    backToTable: 'Back to table',
    backToBoard: 'Back to board',
  },
  zh: {
    backToTable: '返回桌台',
    backToBoard: '返回看板',
  },
  es: {
    backToTable: 'Volver a la mesa',
    backToBoard: 'Volver al panel',
  },
  fr: {
    backToTable: 'Retour à la table',
    backToBoard: 'Retour au tableau',
  },
  de: {
    backToTable: 'Zurück zum Tisch',
    backToBoard: 'Zurück zum Board',
  },
};

export function staffAssistedReturnLabel(flow: StaffAssistedFlow, lang: Language): string {
  const t = STAFF_ASSISTED_MESSAGES[lang];
  return isWaiterTableDetailReturnPath(flow.returnHref) ? t.backToTable : t.backToBoard;
}
