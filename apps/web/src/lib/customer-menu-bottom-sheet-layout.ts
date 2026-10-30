/**
 * Sole layout tokens for customer menu bottom sheet (`CustomerMenuBottomSheet`:
 * cart / 已点 / 本轮核单 / sushi allergen filter). Panel is viewport-capped; header + footer stay pinned;
 * one body scroller only — never max-h on the body alone without capping the panel.
 */

import { CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS } from '@/lib/customer-menu-bottom-bar-layout';
import { CUSTOMER_MENU_SHELL_WIDTH_CLASS } from '@/lib/customer-menu-chrome-layout';

/** Sheet panel — bottom-anchored, never taller than the dynamic viewport. */
export const customerMenuBottomSheetPanelClass = [
  'fixed bottom-0 left-1/2 z-40 flex max-h-[100dvh] -translate-x-1/2 flex-col',
  'overflow-hidden overscroll-none rounded-t-3xl border-t border-brand-border bg-brand-card',
  CUSTOMER_MENU_SHELL_WIDTH_CLASS,
  CUSTOMER_MENU_BOTTOM_SAFE_AREA_PB_CLASS,
  'transition-transform duration-300 ease-out',
].join(' ');

export const customerMenuBottomSheetPanelOpenClass = 'translate-y-0';
export const customerMenuBottomSheetPanelClosedClass = 'translate-y-full';

export const customerMenuBottomSheetHandleRowClass =
  'flex shrink-0 justify-center pb-1 pt-3';

export const customerMenuBottomSheetHeaderClass =
  'flex shrink-0 items-center gap-3 border-b border-brand-border px-5 py-3';

/** Sole vertical scroller for sheet body (cart lines / 已点 / round lines). */
export const customerMenuBottomSheetBodyClass =
  'modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4';

export const customerMenuBottomSheetFooterClass =
  'shrink-0 border-t border-brand-border px-5 py-4';
