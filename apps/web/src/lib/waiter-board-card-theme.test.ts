import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WAITER_BOARD_CARD_THEME,
  WAITER_BOARD_FILTER_KPI_ICON,
  WAITER_BOARD_KPI_TONE_CLASS,
  WAITER_BOARD_LANE_CHROME,
  WAITER_BOARD_PARTY_PANEL_CLASS,
  WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS,
  WAITER_BOARD_SELECTED_EMPHASIS,
  waiterBoardCardShellClass,
  waiterBoardKpiChromeClass,
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
  it('board shells use data-theme status classes, not Tailwind media dark:', () => {
    for (const state of ['dining', 'checkout', 'idle'] as const) {
      const theme = WAITER_BOARD_CARD_THEME[state];
      const shell = waiterBoardCardShellClass(state, true);
      assert.match(shell, new RegExp(`mesa-board-shell-${state}`));
      assertNoMediaDark(shell);
      assertNoMediaDark(theme.title);
      assertNoMediaDark(theme.badge);
      assertNoMediaDark(theme.meta);
      assertNoMediaDark(theme.amount);
      assertNoMediaDark(theme.footer);
      assertNoHardBlack(theme.meta);
      assert.match(theme.title, /text-brand-text/);
      assert.match(theme.meta, /text-brand-text/);
      assert.equal(theme.row3, waiterBoardType.cardRow3);
    }
  });

  it('KPI and party chips share mesa-badge status family', () => {
    assert.match(WAITER_BOARD_KPI_TONE_CLASS.rose, /mesa-badge-danger/);
    assert.match(WAITER_BOARD_KPI_TONE_CLASS.amber, /mesa-badge-warning/);
    assert.match(WAITER_BOARD_KPI_TONE_CLASS.emerald, /mesa-badge-success/);
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.dining, 'mesa-badge-danger');
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.checkout, 'mesa-badge-warning');
    assert.equal(WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS.idle, 'mesa-badge-success');
  });

  it('board type and lane chrome use brand tokens only (no sky palette)', () => {
    assert.match(waiterBoardType.cardTitle, /font-heading/);
    assert.match(waiterBoardType.kpiCount, /text-brand-text/);
    assert.match(WAITER_BOARD_LANE_CHROME.active, /brand-gold/);
    assert.match(WAITER_BOARD_PARTY_PANEL_CLASS, /brand-gold/);
    for (const className of [
      ...Object.values(waiterBoardType),
      ...Object.values(WAITER_BOARD_LANE_CHROME),
      WAITER_BOARD_PARTY_PANEL_CLASS,
      WAITER_BOARD_SELECTED_EMPHASIS,
    ]) {
      assertNoSkyPalette(className);
      assertNoMediaDark(className);
    }
  });

  it('KPI icons and selected emphasis share one active representation', () => {
    assert.equal(WAITER_BOARD_FILTER_KPI_ICON.all, 'floor');
    assert.equal(WAITER_BOARD_FILTER_KPI_ICON.checkout, 'bill');
    assert.equal(WAITER_BOARD_FILTER_KPI_ICON.dining, 'dining');
    assert.equal(WAITER_BOARD_FILTER_KPI_ICON.idle, 'vacant');
    assert.equal(waiterBoardKpiChromeClass(true), WAITER_BOARD_SELECTED_EMPHASIS);
    assert.equal(waiterBoardKpiChromeClass(false), '');
    assert.match(WAITER_BOARD_LANE_CHROME.active, new RegExp(WAITER_BOARD_SELECTED_EMPHASIS));
    assert.match(waiterBoardType.kpiIconWrap, /h-10/);
    assert.match(waiterBoardType.kpiIcon, /h-6/);
  });
});
