'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  filterConsumerNameOptions,
  shouldShowConsumerNameMenu,
} from '@/lib/consumer-name-roster';

interface Props {
  value: string;
  options: string[];
  placeholder: string;
  onChange: (name: string) => void;
  onCommit?: (name: string, fromList: boolean) => void;
  className?: string;
}

export function ConsumerNameCombobox({
  value,
  options,
  placeholder,
  onChange,
  onCommit,
  className = '',
}: Props) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const matches = useMemo(
    () => filterConsumerNameOptions(options, value),
    [options, value],
  );

  const showMenu = focused && matches.length > 0;

  useEffect(() => {
    if (!showMenu) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => (prev >= 0 && prev < matches.length ? prev : 0));
  }, [showMenu, matches.length]);

  const finalize = (name: string, fromList: boolean) => {
    const trimmed = name.trim();
    onChange(trimmed);
    onCommit?.(trimmed, fromList);
    setFocused(false);
    setActiveIndex(-1);
  };

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setFocused(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  return (
    <div ref={rootRef} className={`relative flex-1 min-w-0 ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={showMenu}
        aria-controls={showMenu ? listboxId : undefined}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => setFocused(shouldShowConsumerNameMenu(options, value))}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next);
          setFocused(shouldShowConsumerNameMenu(options, next));
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && matches.length > 0) {
            event.preventDefault();
            setFocused(true);
            setActiveIndex((prev) => Math.min(prev + 1, matches.length - 1));
            return;
          }
          if (event.key === 'ArrowUp' && matches.length > 0) {
            event.preventDefault();
            setFocused(true);
            setActiveIndex((prev) => Math.max(prev - 1, 0));
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (showMenu && activeIndex >= 0 && matches[activeIndex]) {
              finalize(matches[activeIndex], true);
              return;
            }
            finalize(value, false);
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setFocused(false);
            setActiveIndex(-1);
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            if (!rootRef.current?.contains(document.activeElement)) {
              finalize(value, false);
            }
          }, 0);
        }}
        className="w-full bg-brand-bg border border-brand-border rounded-lg px-3 py-2 text-[14px] text-brand-text placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
      />

      {showMenu ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-lg border border-brand-border bg-brand-card shadow-lg py-1"
        >
          {matches.map((name, index) => {
            const active = index === activeIndex;
            return (
              <li key={name} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => finalize(name, true)}
                  className={`w-full text-left px-3 py-2.5 text-[14px] transition-colors ${
                    active
                      ? 'bg-brand-gold/15 text-brand-gold'
                      : 'text-brand-text hover:bg-brand-border/40'
                  }`}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
