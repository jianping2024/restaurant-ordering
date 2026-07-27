import type { UILanguage } from '@/lib/i18n';

/** Guest-selectable split modes (excludes staff/persisted `whole_table`). */
export const GUEST_SPLIT_MODE_ORDER = ['even', 'by_item', 'custom'] as const;
export type GuestSplitModeId = (typeof GUEST_SPLIT_MODE_ORDER)[number];

export type GuestSplitModeCopy = {
  label: string;
  /** One-line “when to use” — shown after the mode is selected on the bill. */
  when: string;
};

export type GuestSplitIntroPreviewDemo = {
  caption: string;
  lines: readonly [string, string];
  people: readonly [{ name: string; amount: string }, { name: string; amount: string }];
};

/**
 * Single source for guest split vocabulary: labels, when-to-use, page tip,
 * intro step copy, and intro preview demo. Intro + bill UI must read from here.
 */
export type GuestSplitGuidanceCopy = {
  modes: Record<GuestSplitModeId, GuestSplitModeCopy>;
  /** Shown when no mode is selected (whole-table path still allowed). */
  optionalHint: string;
  introStep: { title: string; body: string };
  introPreview: GuestSplitIntroPreviewDemo;
};

export const GUEST_SPLIT_GUIDANCE: Record<UILanguage, GuestSplitGuidanceCopy> = {
  zh: {
    modes: {
      even: { label: '均摊', when: '几个人平分总金额。' },
      by_item: { label: '按菜', when: '谁点的谁付。把每道菜分给对应的人。' },
      custom: { label: '手填金额', when: '已经谈好各付多少，直接填数字，加起来要等于合计。' },
    },
    optionalHint: '想分单？选一种方式。整桌一起付也可以不选，直接呼叫结账。',
    introStep: {
      title: '分单',
      body: '各人点的菜不一样时，用「按菜」——把每道菜分给对应的人。',
    },
    introPreview: {
      caption: '示例：谁点的谁付',
      lines: ['炒饭 ×1 → 小明', '烤鱼 ×1 → 小明一半 · 小红一半'],
      people: [
        { name: '小明', amount: '14,20' },
        { name: '小红', amount: '9,80' },
      ],
    },
  },
  en: {
    modes: {
      even: { label: 'Even split', when: 'Split the total equally among N people.' },
      by_item: { label: 'By dish', when: 'Each pays for what they ordered. Assign dishes to people.' },
      custom: {
        label: 'Enter amounts',
        when: 'You already agreed on amounts — enter each share until they match the total.',
      },
    },
    optionalHint:
      'Want to split? Pick a method above. Paying for the whole table? Call for the bill without choosing one.',
    introStep: {
      title: 'Split the bill',
      body: 'If people ordered different dishes, use By dish — assign each dish to the right person.',
    },
    introPreview: {
      caption: 'Example: each pays for what they ordered',
      lines: ['Fried rice ×1 → Ana', 'Grilled fish ×1 → half Ana · half João'],
      people: [
        { name: 'Ana', amount: '14.20' },
        { name: 'João', amount: '9.80' },
      ],
    },
  },
  pt: {
    modes: {
      even: { label: 'Partes iguais', when: 'Dividir o total por N pessoas.' },
      by_item: {
        label: 'Por prato',
        when: 'Cada um paga o que pediu. Atribua os pratos às pessoas.',
      },
      custom: {
        label: 'Valores',
        when: 'Já combinaram quantias — escrevam o valor de cada um até bater com o total.',
      },
    },
    optionalHint:
      'Quer dividir? Escolha uma forma acima. Se paga a mesa toda, pode chamar o fechamento sem escolher.',
    introStep: {
      title: 'Dividir a conta',
      body: 'Se cada um pediu pratos diferentes, use Por prato — atribua cada prato às pessoas.',
    },
    introPreview: {
      caption: 'Exemplo: cada um paga o que pediu',
      lines: ['Arroz frito ×1 → Ana', 'Peixe grelhado ×1 → ½ Ana · ½ João'],
      people: [
        { name: 'Ana', amount: '14,20' },
        { name: 'João', amount: '9,80' },
      ],
    },
  },
};

export function getGuestSplitGuidance(lang: UILanguage): GuestSplitGuidanceCopy {
  return GUEST_SPLIT_GUIDANCE[lang];
}

/** Short labels for guest modes — same strings as bill buttons / staff badges. */
export function guestSplitModeLabels(lang: UILanguage): {
  even: string;
  byItem: string;
  custom: string;
} {
  const { modes } = getGuestSplitGuidance(lang);
  return {
    even: modes.even.label,
    byItem: modes.by_item.label,
    custom: modes.custom.label,
  };
}

/** Staff/checkout badges: guest mode labels + whole-table label from checkout i18n. */
export function checkoutSplitModeUiLabels(
  lang: UILanguage,
  wholeTable: string,
): { even: string; byItem: string; custom: string; wholeTable: string } {
  return { ...guestSplitModeLabels(lang), wholeTable };
}
