'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fitStaffTopBarRestaurantName } from '@/lib/staff-topbar-restaurant-name';
import { staffTopBarChrome } from '@/lib/waiter-staff-sticky-chrome';

/**
 * Sole staff top-bar store-name node: measures the leftover slot and fits via
 * `fitStaffTopBarRestaurantName` (drop words from the right, then ellipsis).
 */
export function ProductTopBarRestaurantName({ name }: { name: string }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  // Prefer full name for intrinsic brand width (desktop three-zone); fit only when the slot is actually clamped.
  const [display, setDisplay] = useState(name);

  const measure = useCallback((text: string) => {
    const el = probeRef.current;
    if (!el) return 0;
    el.textContent = text;
    return el.getBoundingClientRect().width;
  }, []);

  const recompute = useCallback(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const budget = slot.getBoundingClientRect().width;
    // Unclamped / not yet laid out: keep full name so brand can size to content (lg:flex-initial).
    if (budget <= 0) {
      setDisplay(name.trim().replace(/\s+/g, ' '));
      return;
    }
    setDisplay(fitStaffTopBarRestaurantName(name, budget, measure).display);
  }, [measure, name]);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(slot);
    return () => ro.disconnect();
  }, [recompute]);

  return (
    <div ref={slotRef} className="min-w-0 overflow-hidden max-lg:flex-1">
      <span className={staffTopBarChrome.restaurantNameClassName} title={name}>
        {display || '\u00a0'}
      </span>
      <span
        ref={probeRef}
        aria-hidden
        className={`pointer-events-none absolute -left-[9999px] top-0 ${staffTopBarChrome.restaurantNameMeasureClassName}`}
      />
    </div>
  );
}
