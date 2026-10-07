import type { UILanguage } from '@/lib/i18n';

/** Guest-selectable split modes on the phone bill (custom removed). */
export const GUEST_SPLIT_MODE_ORDER = ['whole_table', 'by_item', 'even'] as const;
export type GuestSplitModeId = (typeof GUEST_SPLIT_MODE_ORDER)[number];

export type GuestSplitModeCopy = {
  label: string;
  /** One-line “when to use” after mode select — empty string hides the tip. */
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
  /** Shown under chips for the default whole_table path. */
  optionalHint: string;
  introStep: { title: string; body: string };
  introPreview: GuestSplitIntroPreviewDemo;
};

export const GUEST_SPLIT_GUIDANCE: Record<UILanguage, GuestSplitGuidanceCopy> = {
  zh: {
    modes: {
      whole_table: { label: '整桌', when: '一个人付整桌，或先叫店员结账。' },
      even: { label: '均摊', when: '几个人平分总金额。' },
      by_item: { label: '按菜', when: '只选自己要付的菜。' },
    },
    optionalHint: '默认整桌。要分单时再选按菜或均摊。',
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
      whole_table: { label: 'Whole table', when: 'One person pays for the table.' },
      even: { label: 'Even split', when: 'Split the total equally among N people.' },
      by_item: { label: 'By dish', when: 'Pick only the dishes you’re paying for.' },
    },
    optionalHint: 'Whole table is the default. Pick By dish or Even to split.',
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
      whole_table: { label: 'Mesa', when: 'Uma pessoa paga a mesa toda.' },
      even: { label: 'Partes iguais', when: 'Dividir o total por N pessoas.' },
      by_item: {
        label: 'Por prato',
        when: 'Escolha só os pratos que vai pagar.',
      },
    },
    optionalHint: 'Mesa é o padrão. Escolha Por prato ou Partes iguais para dividir.',
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
  es: {
    modes: {
      whole_table: { label: 'Mesa', when: 'Una persona paga toda la mesa.' },
      even: { label: 'A partes iguales', when: 'Dividir el total entre los comensales.' },
      by_item: {
        label: 'Por plato',
        when: 'Elige solo los platos que vas a pagar.',
      },
    },
    optionalHint: 'Mesa es el valor por defecto. Elige Por plato o A partes iguales para dividir.',
    introStep: {
      title: 'Dividir la cuenta',
      body: 'Si cada uno ha pedido platos distintos, usa Por plato: asigna cada plato a quien corresponda.',
    },
    introPreview: {
      caption: 'Ejemplo: cada uno paga lo que pidió',
      lines: ['Arroz frito ×1 → Lucía', 'Pescado a la plancha ×1 → ½ Lucía · ½ Marcos'],
      people: [
        { name: 'Lucía', amount: '14,20' },
        { name: 'Marcos', amount: '9,80' },
      ],
    },
  },
  fr: {
    modes: {
      whole_table: { label: 'Table', when: 'Une personne règle toute la table.' },
      even: { label: 'Parts égales', when: 'Partager le total entre les convives.' },
      by_item: {
        label: 'Par plat',
        when: 'Choisissez seulement les plats que vous allez payer.',
      },
    },
    optionalHint: 'Table est le choix par défaut. Choisissez Par plat ou Parts égales pour partager.',
    introStep: {
      title: 'Partager l’addition',
      body: 'Si chacun a commandé des plats différents, utilisez Par plat : attribuez chaque plat à la bonne personne.',
    },
    introPreview: {
      caption: 'Exemple : chacun paie ce qu’il a commandé',
      lines: ['Riz cantonais ×1 → Camille', 'Poisson grillé ×1 → ½ Camille · ½ Julien'],
      people: [
        { name: 'Camille', amount: '14,20' },
        { name: 'Julien', amount: '9,80' },
      ],
    },
  },
  de: {
    modes: {
      whole_table: { label: 'Tisch', when: 'Eine Person zahlt den ganzen Tisch.' },
      even: { label: 'Gleich aufteilen', when: 'Die Summe gleichmäßig auf alle Gäste aufteilen.' },
      by_item: {
        label: 'Nach Gericht',
        when: 'Wählen Sie nur die Gerichte, die Sie zahlen.',
      },
    },
    optionalHint: 'Tisch ist die Voreinstellung. Wählen Sie Nach Gericht oder Gleich zum Teilen.',
    introStep: {
      title: 'Rechnung teilen',
      body: 'Wenn alle unterschiedlich bestellt haben, nutzen Sie Nach Gericht: Jedes Gericht der richtigen Person zuordnen.',
    },
    introPreview: {
      caption: 'Beispiel: Jeder zahlt, was er bestellt hat',
      lines: ['Gebratener Reis ×1 → Lena', 'Gegrillter Fisch ×1 → ½ Lena · ½ Jonas'],
      people: [
        { name: 'Lena', amount: '14,20' },
        { name: 'Jonas', amount: '9,80' },
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
} {
  const { modes } = getGuestSplitGuidance(lang);
  return {
    even: modes.even.label,
    byItem: modes.by_item.label,
  };
}

/** Staff/checkout badges: guest mode labels + whole-table label from checkout i18n. */
export function checkoutSplitModeUiLabels(
  lang: UILanguage,
  wholeTable: string,
): { even: string; byItem: string; wholeTable: string } {
  return { ...guestSplitModeLabels(lang), wholeTable };
}
