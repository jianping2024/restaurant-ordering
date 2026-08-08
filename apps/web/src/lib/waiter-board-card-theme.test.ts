import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { waiterStaffStickyChrome } from './waiter-staff-sticky-chrome';
import {
  WAITER_BOARD_CARD_THEME,
  WAITER_BOARD_KPI_COUNT_CLASS,
  WAITER_BOARD_KPI_GRID_CLASS,
  WAITER_BOARD_KPI_RULE_ACTIVE_CLASS,
  WAITER_BOARD_KPI_RULE_CLASS,
  WAITER_BOARD_LANE_CHROME,
  WAITER_BOARD_LANE_STICKY_SCROLL_CLEARANCE,
  WAITER_BOARD_LANE_STICKY_SHELL,
  WAITER_BOARD_PARTY_PANEL_CLASS,
  WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS,
  WAITER_BOARD_SELECTED_EMPHASIS,
  waiterBoardCardShellClass,
  waiterBoardType,
} from './waiter-board-card-theme';

function assertNoMediaDark(className: string) {
  assert.doesNotMatch(className, /\bdark:/);
}

function assertNoHardBlack(className: string) {
  assert.doesNotMatch(className, /\btext-black\b/);
}

function assertNoSkyPalette(className: string) {
  assert.doesNotMatch(className, /\bsky-/);
}

describe('waiter-board-card-theme theme tokens', () => {
  it('board shells use scroll-frame status modifiers, not Tailwind media dark:', () => {
    const states = ['dining', 'checkout', 'idle'] as const;
    const expected: Record<(typeof states)[number], RegExp> = {
      dining: /mesa-scroll-frame is-dining/,
      checkout: /mesa-scroll-frame is-pending/,
      idle: /mesa-scroll-frame is-free/,
    };
    for (const state of states) {
      const theme = WAITER_BOARD_CARD_THEME[state];
      const shell = waiterBoardCardShellClass(state, true);
      assert.match(shell, expected[state]);
      assertNoMediaDark(shell);
      assertNoMediaDark(theme.title);
      assertNoMediaDark(theme.cta);
      assertNoHardBlack(theme.title);
      assert.match(theme.title, /text-brand-text/);
    }
  });

  it('party chips share mesa-badge status family', () => {
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.dining, 'mesa-badge-danger');
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.checkout, 'mesa-badge-warning');
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.idle, 'mesa-badge-success');
  });

  it('board type and lane chrome use brand tokens only (no sky palette)', () => {
    assert.match(waiterBoardType.cardTitle, /font-heading/);
    assert.match(waiterBoardType.cardAmount, /mesa-money/);
    assert.match(waiterBoardType.cardAmount, /text-base/);
    assert.match(waiterBoardType.cardAmount, /text-brand-gold/);
    assert.doesNotMatch(waiterBoardType.cardAmount, /mesa-text-(danger|warning)/);
    assert.match(waiterBoardType.cardStatus, /^mesa-status-vertical$/);
    assert.match(waiterBoardType.cardBadge, /text-brand-gold/);
    assert.match(waiterBoardType.cardMeta, /text-sm/);
    assert.match(waiterBoardType.cardMeta, /text-brand-text/);
    assert.match(waiterBoardType.cardCta, /text-sm/);
    for (const theme of Object.values(WAITER_BOARD_CARD_THEME)) {
      assert.equal('amount' in theme, false, 'amount color lives only on waiterBoardType.cardAmount');
    }
    assert.match(WAITER_BOARD_LANE_CHROME.active, /bg-brand-ink/);
    assert.match(WAITER_BOARD_PARTY_PANEL_CLASS, /brand-ink/);
    for (const className of [
      ...Object.values(waiterBoardType),
      ...Object.values(WAITER_BOARD_LANE_CHROME),
      WAITER_BOARD_PARTY_PANEL_CLASS,
      WAITER_BOARD_SELECTED_EMPHASIS,
      ...Object.values(WAITER_BOARD_KPI_COUNT_CLASS),
      ...Object.values(WAITER_BOARD_KPI_RULE_CLASS),
    ]) {
      assertNoSkyPalette(className);
      assertNoMediaDark(className);
    }
  });

  it('card surface roles are complete — no parallel badge/meta/cta/status class strings at call sites', () => {
    const keys = Object.keys(waiterBoardType);
    for (const key of [
      'cardTitle',
      'cardBadge',
      'cardMeta',
      'cardAmount',
      'cardCta',
      'cardStatus',
    ]) {
      assert.equal(keys.includes(key), true, `missing waiterBoardType.${key}`);
    }
  });

  it('lane sticky shell reuses staff top-bar offset with opaque page bg', () => {
    assert.match(WAITER_BOARD_LANE_STICKY_SHELL, /sticky/);
    assert.equal(
      WAITER_BOARD_LANE_STICKY_SHELL.includes(waiterStaffStickyChrome.belowStaffTopBar),
      true,
    );
    assert.match(WAITER_BOARD_LANE_STICKY_SHELL, /bg-brand-bg/);
    assert.match(WAITER_BOARD_LANE_STICKY_SHELL, /z-20/);
    // Dock breath is inside paint (pb), not exterior margin (cards would show through).
    assert.match(WAITER_BOARD_LANE_STICKY_SHELL, /\bpb-4\b/);
    assert.doesNotMatch(WAITER_BOARD_LANE_STICKY_SHELL, /\bmb-/);
    assert.match(WAITER_BOARD_LANE_STICKY_SCROLL_CLEARANCE, /\bpb-24\b/);
    assertNoSkyPalette(WAITER_BOARD_LANE_STICKY_SHELL);
  });

  it('selected lane face is solid ink without ring; KPI uses fine-line rule colors', () => {
    assert.doesNotMatch(WAITER_BOARD_SELECTED_EMPHASIS, /\bring-/);
    assert.match(WAITER_BOARD_SELECTED_EMPHASIS, /bg-brand-ink/);
    assert.match(WAITER_BOARD_SELECTED_EMPHASIS, /text-brand-on-ink/);
    assert.equal(WAITER_BOARD_LANE_CHROME.active.includes(WAITER_BOARD_SELECTED_EMPHASIS), true);
    assert.match(WAITER_BOARD_KPI_COUNT_CLASS.checkout, /mesa-text-warning/);
    assert.match(WAITER_BOARD_KPI_COUNT_CLASS.dining, /mesa-text-danger/);
    assert.match(WAITER_BOARD_KPI_COUNT_CLASS.idle, /mesa-text-success/);
    assert.match(WAITER_BOARD_KPI_RULE_CLASS.all, /brand-gold/);
    assert.equal(WAITER_BOARD_KPI_RULE_ACTIVE_CLASS, 'bg-brand-gold');
    assert.match(WAITER_BOARD_KPI_GRID_CLASS, /grid-cols-2/);
    assert.match(WAITER_BOARD_KPI_GRID_CLASS, /sm:grid-cols-4/);
  });
});
