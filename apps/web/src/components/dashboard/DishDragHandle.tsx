import type { DragEvent } from 'react';

type Props = {
  label: string;
  disabled?: boolean;
  onDragStart: (event: DragEvent<HTMLSpanElement>) => void;
};

const handleClass =
  'h-8 w-6 inline-flex items-center justify-center rounded-md text-brand-text-muted hover:text-brand-gold cursor-grab active:cursor-grabbing select-none touch-none disabled:opacity-35 disabled:cursor-not-allowed';

/** Sole dish-list reorder control: HTML5 drag handle (no ↑↓). */
export function DishDragHandle({ label, disabled, onDragStart }: Props) {
  return (
    <span
      role="button"
      tabIndex={disabled ? -1 : 0}
      draggable={!disabled}
      aria-label={label}
      title={label}
      aria-disabled={disabled || undefined}
      onDragStart={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onDragStart(event);
      }}
      className={handleClass}
    >
      <span aria-hidden className="text-sm leading-none tracking-tighter">
        ⠿
      </span>
    </span>
  );
}
