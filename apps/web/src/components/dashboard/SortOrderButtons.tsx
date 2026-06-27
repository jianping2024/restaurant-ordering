type Props = {
  index: number;
  length: number;
  moveUpLabel: string;
  moveDownLabel: string;
  onMove: (dir: -1 | 1) => void;
  className?: string;
};

const btnClass =
  'h-8 w-8 inline-flex items-center justify-center rounded-md border border-brand-border/70 text-brand-text-muted hover:text-brand-gold disabled:opacity-35';

export function SortOrderButtons({
  index,
  length,
  moveUpLabel,
  moveDownLabel,
  onMove,
  className = '',
}: Props) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`.trim()}>
      <button
        type="button"
        aria-label={moveUpLabel}
        title={moveUpLabel}
        disabled={index === 0}
        onClick={() => onMove(-1)}
        className={btnClass}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={moveDownLabel}
        title={moveDownLabel}
        disabled={index === length - 1}
        onClick={() => onMove(1)}
        className={btnClass}
      >
        ↓
      </button>
    </div>
  );
}
