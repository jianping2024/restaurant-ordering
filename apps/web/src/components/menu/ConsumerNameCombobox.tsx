'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { filterConsumerNameOptions } from '@/lib/consumer-name-roster';
import {
  SOFT_KEYBOARD_DISMISS_ARM_MS,
  fixedBarBottomAboveVisualViewport,
} from '@/lib/soft-keyboard-viewport';
import { customerTextInputClass } from '@/components/menu/customer-form-input-styles';
import { useReportGuestConsumerNameEditActive } from '@/components/menu/guest-consumer-name-edit-chrome';
import {
  mesaSelectionChipShellClass,
  mesaSelectionChipSoftClass,
} from '@/lib/mesa-selection-chip';

/** Sole suggestion UI: keyboard-fused horizontal chip rail (not input-anchored dropdown). */
export const CONSUMER_NAME_KEYBOARD_RAIL_CLASS =
  'fixed left-1/2 z-40 w-full max-w-mobile -translate-x-1/2 border-t border-[#b8b2a8] bg-[#d5d2cc]';

interface Props {
  value: string;
  options: string[];
  placeholder: string;
  /** Pinned rail chip: leave pick mode and open the soft keyboard. */
  typeNewLabel: string;
  readOnly?: boolean;
  onChange: (name: string) => void;
  onCommit?: (name: string, fromList: boolean) => void;
  className?: string;
}

function useFixedBarBottomInset(active: boolean): number {
  const [bottom, setBottom] = useState(0);
  useEffect(() => {
    if (!active) {
      setBottom(0);
      return;
    }
    const update = () => {
      const vv = window.visualViewport;
      if (!vv) {
        setBottom(0);
        return;
      }
      setBottom(
        fixedBarBottomAboveVisualViewport(
          window.innerHeight,
          vv.offsetTop,
          vv.height,
        ),
      );
    };
    update();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [active]);
  return bottom;
}

export function ConsumerNameCombobox({
  value,
  options,
  placeholder,
  typeNewLabel,
  readOnly = false,
  onChange,
  onCommit,
  className = '',
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const blurCommitTimerRef = useRef<number | null>(null);
  const reportNameEditActive = useReportGuestConsumerNameEditActive();
  const [inputFocused, setInputFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Pick mode (default when names exist): rail lists the roster, no soft keyboard.
  const [typing, setTyping] = useState(false);
  const [mounted, setMounted] = useState(false);

  valueRef.current = value;

  const matches = useMemo(
    () => filterConsumerNameOptions(options, value),
    [options, value],
  );

  const showRail = inputFocused && matches.length > 0;
  const bottomInset = useFixedBarBottomInset(showRail);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showRail) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => (prev >= 0 && prev < matches.length ? prev : 0));
  }, [showRail, matches.length]);

  const clearBlurCommitTimer = () => {
    if (blurCommitTimerRef.current != null) {
      window.clearTimeout(blurCommitTimerRef.current);
      blurCommitTimerRef.current = null;
    }
  };

  const finalize = (name: string, fromList: boolean) => {
    inputRef.current?.blur();
    clearBlurCommitTimer();
    const trimmed = name.trim();
    onChange(trimmed);
    onCommit?.(trimmed, fromList);
    setInputFocused(false);
    setActiveIndex(-1);
    setTyping(false);
  };

  const startTyping = () => {
    // iOS reads inputMode at focus time and only inside the tap gesture.
    flushSync(() => setTyping(true));
    inputRef.current?.blur();
    inputRef.current?.focus();
  };

  useEffect(() => {
    if (!inputFocused) return;
    reportNameEditActive(true);
    return () => {
      reportNameEditActive(false);
    };
  }, [inputFocused, reportNameEditActive]);

  // Name edit must not scroll the document. The suggestion rail is position:fixed
  // above the soft keyboard; scrolling on visualViewport resize fights the
  // keyboard (page shake + dismiss on iOS). Custom-amount keeps its own scroll.

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || railRef.current?.contains(target)) {
        return;
      }
      if (!inputFocused) return;
      setInputFocused(false);
      setActiveIndex(-1);
      setTyping(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [inputFocused]);

  useEffect(() => () => clearBlurCommitTimer(), []);

  const rail =
    mounted && showRail
      ? createPortal(
          <div
            ref={railRef}
            data-consumer-name-rail="1"
            className={CONSUMER_NAME_KEYBOARD_RAIL_CLASS}
            style={{ bottom: bottomInset }}
          >
            <div className="flex items-center gap-2 px-3 py-2">
              {!typing ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={startTyping}
                  className={`${mesaSelectionChipShellClass} shrink-0 border-dashed px-3.5 py-1.5 text-[14px] font-semibold ${mesaSelectionChipSoftClass(false)}`}
                >
                  {typeNewLabel}
                </button>
              ) : null}
              <div
                id={listboxId}
                role="listbox"
                aria-label={placeholder}
                className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {matches.map((name, index) => {
                  const active = index === activeIndex;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => finalize(name, true)}
                      className={`${mesaSelectionChipShellClass} shrink-0 px-3.5 py-1.5 text-[14px] font-semibold ${mesaSelectionChipSoftClass(active)}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative flex-1 min-w-0 ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showRail}
        aria-controls={showRail ? listboxId : undefined}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        inputMode={typing ? 'text' : 'none'}
        onFocus={() => {
          if (readOnly) return;
          clearBlurCommitTimer();
          // Straight to typing when there is nothing to pick or an existing name is being edited.
          if (!typing && (options.length === 0 || value.trim())) setTyping(true);
          setInputFocused(true);
        }}
        onChange={(event) => {
          if (readOnly) return;
          onChange(event.target.value);
          setInputFocused(true);
        }}
        onKeyDown={(event) => {
          if (
            (event.key === 'ArrowDown' || event.key === 'ArrowRight') &&
            matches.length > 0
          ) {
            event.preventDefault();
            setInputFocused(true);
            setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
            return;
          }
          if (
            (event.key === 'ArrowUp' || event.key === 'ArrowLeft') &&
            matches.length > 0
          ) {
            event.preventDefault();
            setInputFocused(true);
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (showRail && activeIndex >= 0 && matches[activeIndex]) {
              finalize(matches[activeIndex], true);
              return;
            }
            finalize(value, false);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setInputFocused(false);
            setActiveIndex(-1);
          }
        }}
        onBlur={() => {
          // Ignore transient blur from rail mount / layout (same arm window as
          // soft-keyboard dismiss). Real leave → finalize after the arm.
          clearBlurCommitTimer();
          blurCommitTimerRef.current = window.setTimeout(() => {
            blurCommitTimerRef.current = null;
            if (
              rootRef.current?.contains(document.activeElement) ||
              railRef.current?.contains(document.activeElement)
            ) {
              return;
            }
            finalize(valueRef.current, false);
          }, SOFT_KEYBOARD_DISMISS_ARM_MS);
        }}
        className={`${customerTextInputClass}${readOnly ? ' opacity-70 cursor-default' : ''}`}
      />
      {rail}
    </div>
  );
}
