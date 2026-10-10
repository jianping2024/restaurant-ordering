/**
 * Sole selected/idle chrome for selectable chips.
 * Strong = switches the whole content block; soft = pick within a local option group.
 * Call sites add size/layout only — do not restate gold fill/border/text beside these.
 * Press feedback = sole {@link buttonPressReliefCompactClass}.
 */

import { buttonPressReliefCompactClass } from '@/components/ui/button-press-relief';

/** Shared shell: always bordered so soft selected gold edge is visible on paper. */
export const mesaSelectionChipShellClass = `rounded-full border transition-all duration-200 ${buttonPressReliefCompactClass}`;

/** Soft: notes / allergens / sub-categories / weekday toggles. */
export function mesaSelectionChipSoftClass(selected: boolean): string {
  return selected
    ? 'border-brand-gold/40 bg-brand-gold/20 text-brand-gold'
    : 'border-brand-border bg-brand-card text-brand-text-muted hover:text-brand-text';
}

/** Strong: top category / list filter that replaces the main content. */
export function mesaSelectionChipStrongClass(selected: boolean): string {
  return selected
    ? 'border-brand-gold bg-brand-gold text-brand-on-gold'
    : 'border-brand-border bg-brand-bg text-brand-text';
}
