import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

type Props = {
  label: string;
  disabled?: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
};

const handleClass =
  'h-8 w-6 shrink-0 inline-flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-gold cursor-grab active:cursor-grabbing select-none touch-none disabled:opacity-35 disabled:cursor-not-allowed';

/**
 * Sole dish-list reorder control: @hello-pangea/dnd drag handle
 * (desktop + touch; no HTML5 draggable).
 */
export function DishDragHandle({ label, disabled, dragHandleProps }: Props) {
  return (
    <span
      {...(disabled ? undefined : dragHandleProps)}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      className={handleClass}
    >
      <span aria-hidden className="text-sm leading-none tracking-tighter">
        ⠿
      </span>
    </span>
  );
}
