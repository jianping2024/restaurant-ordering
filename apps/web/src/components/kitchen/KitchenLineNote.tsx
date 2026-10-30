/**
 * Sole kitchen note chrome: list rows = second line under the title; prep tray = dedicated strip.
 * Empty/whitespace note → null. Callers pass `lineNoteKey` / `card.note` (already trimmed).
 */
export function KitchenLineNote({
  note,
  variant,
  label,
}: {
  note: string;
  variant: 'row' | 'tray';
  /** Tray strip prefix only («备注» / «Note» / …). */
  label?: string;
}) {
  if (!note) return null;

  if (variant === 'tray') {
    return (
      <p className="mesa-kitchen-tray-note rounded-lg border border-brand-gold/30 bg-brand-gold/10 px-2.5 py-1.5 text-xl font-semibold leading-snug text-amber-800/95 break-words">
        {label ? (
          <span className="mr-1.5 text-sm font-semibold uppercase tracking-wide text-brand-gold">
            {label}
          </span>
        ) : null}
        {note}
      </p>
    );
  }

  return (
    <span className="mesa-kitchen-row-note mt-0.5 block truncate text-xl font-medium leading-snug text-amber-800/90">
      {note}
    </span>
  );
}
