import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WAITER_BOARD_CARD_THEME,
  WAITER_BOARD_KPI_TONE_CLASS,
  WAITER_BOARD_PARTY_REMOVE_CHIP_CLASS,
  waiterBoardCardShellClass,
} from './waiter-board-card-theme';

function assertNoMediaDark(className: string) {
  assert.doesNotMatch(className, /\bdark:/);
}

function assertNoHardBlack(className: string) {
  assert.doesNotMatch(className, /\btext-black\b/);
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
});
