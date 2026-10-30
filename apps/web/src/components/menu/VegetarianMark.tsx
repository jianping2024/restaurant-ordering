import { VegetarianLeafIcon } from '@/components/menu/customer-ordering-icons';

type Props = {
  /** Localized「素食」— thumb uses it as tooltip; label shows it beside the leaf. */
  label: string;
  /**
   * `thumb`: leaf disc pinned to the list-card thumb's top-left (icon only;
   * the card's detail button aria-label carries the word).
   * `label`: leaf + word pill (guest detail sheet, kitchen detail).
   */
  variant: 'thumb' | 'label';
};

/** Sole vegetarian mark — one glyph, one status-success palette, every surface. */
export function VegetarianMark({ label, variant }: Props) {
  if (variant === 'thumb') {
    return (
      <span className="mesa-veg-mark-thumb" title={label} aria-hidden>
        <VegetarianLeafIcon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span className="mesa-badge-success inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium">
      <VegetarianLeafIcon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </span>
  );
}
