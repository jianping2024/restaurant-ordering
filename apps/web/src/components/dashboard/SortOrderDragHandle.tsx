import type { CSSProperties } from 'react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

type Props = {
  label: string;
  disabled?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  /** Extra classes (e.g. compact height on category tree). */
  className?: string;
  /** Compact sizing from a single caller-owned metric (e.g. category-tree lead). */
  style?: CSSProperties;
};

const handleClass =
  'h-8 w-6 shrink-0 inline-flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-gold cursor-grab active:cursor-grabbing select-none touch-none disabled:opacity-35 disabled:cursor-not-allowed';

/**
 * Sole list-reorder control for dashboard sort_order surfaces:
 * @hello-pangea/dnd drag handle (desktop + touch; no HTML5 draggable / ↑↓).
 */
export function SortOrderDragHandle({
  label,
  disabled,
  dragHandleProps,
  className,
  style,
}: Props) {
  return (
    <span
      {...(disabled ? undefined : dragHandleProps)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      className={className ? `${handleClass} ${className}` : handleClass}
      style={style}
    >
      <span aria-hidden className="text-sm leading-none tracking-tighter">
        ⠿
      </span>
    </span>
  );
}
