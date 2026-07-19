'use client';

import {
  InputHTMLAttributes,
  forwardRef,
  useRef,
  type ChangeEvent,
  type MutableRefObject,
  type PointerEvent,
  type Ref,
} from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** When true, show a clear control while the field has a non-empty value. */
  clearable?: boolean;
  /** Accessible label for the clear control (required for a11y when clearable). */
  clearLabel?: string;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
}

function emitEmptyChange(onChange?: (event: ChangeEvent<HTMLInputElement>) => void) {
  if (!onChange) return;
  onChange({
    target: { value: '' },
    currentTarget: { value: '' },
  } as ChangeEvent<HTMLInputElement>);
}

/**
 * Clear writes empty only through onChange (controlled) or the native value (uncontrolled).
 * Pointer-down runs first with preventDefault so mobile focus/keyboard dismiss cannot swallow clear.
 */
function clearFieldValue(options: {
  input: HTMLInputElement | null;
  controlled: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const { input, controlled, onChange } = options;
  if (!controlled && input) {
    input.value = '';
  }
  emitEmptyChange(onChange);
  input?.focus();
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, clearable = false, clearLabel, className = '', ...props }, ref) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const controlled = props.value !== undefined;
    const resolvedValue = props.value ?? props.defaultValue;
    const hasValue =
      resolvedValue !== undefined && resolvedValue !== null && String(resolvedValue).length > 0;
    const showClear = clearable && hasValue && !props.disabled;

    const runClear = () => {
      clearFieldValue({
        input: inputRef.current,
        controlled,
        onChange: props.onChange,
      });
    };

    const onClearPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      // Keep the input focused so iOS/Android do not cancel the clear gesture on blur.
      event.preventDefault();
      runClear();
    };

    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label className="text-sm text-brand-text-muted font-medium">{label}</label>
        ) : null}
        <div className="relative">
          <input
            ref={(node) => {
              inputRef.current = node;
              assignRef(ref, node);
            }}
            className={`
            w-full bg-brand-card border rounded-lg px-4 py-2.5
            text-base text-brand-text placeholder-brand-muted
            focus:outline-none focus:ring-2 focus:ring-brand-gold/50
            transition-colors duration-200
            ${error ? 'border-red-500' : 'border-brand-border'}
            ${showClear ? 'pr-11' : ''}
            ${className}
          `}
            {...props}
          />
          {showClear ? (
            <button
              type="button"
              tabIndex={-1}
              disabled={props.disabled}
              aria-label={clearLabel || 'Clear'}
              onPointerDown={onClearPointerDown}
              onClick={runClear}
              className="absolute right-0 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-lg leading-none text-brand-text-muted hover:text-brand-text disabled:pointer-events-none disabled:opacity-50"
            >
              ×
            </button>
          ) : null}
        </div>
        {error ? <p className="mesa-text-danger text-[13px]">{error}</p> : null}
      </div>
    );
  }
);
Input.displayName = 'Input';
