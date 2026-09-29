import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  mesaSelectionChipShellClass,
  mesaSelectionChipSoftClass,
  mesaSelectionChipStrongClass,
} from './mesa-selection-chip.ts';

describe('mesaSelectionChip', () => {
  it('soft selected always includes gold border so paper contrast is visible', () => {
    const on = mesaSelectionChipSoftClass(true);
    assert.match(on, /border-brand-gold\/40/);
    assert.match(on, /bg-brand-gold\/20/);
    assert.match(on, /text-brand-gold/);
    assert.doesNotMatch(on, /text-brand-on-gold/);
  });

  it('soft idle keeps a border (not fill-only)', () => {
    const off = mesaSelectionChipSoftClass(false);
    assert.match(off, /border-brand-border/);
    assert.match(off, /bg-brand-card/);
  });

  it('strong selected is solid gold fill + on-gold text', () => {
    const on = mesaSelectionChipStrongClass(true);
    assert.match(on, /bg-brand-gold(?!\/)/);
    assert.match(on, /text-brand-on-gold/);
  });

  it('shell is the sole rounded-full border wrapper', () => {
    assert.match(mesaSelectionChipShellClass, /rounded-full/);
    assert.match(mesaSelectionChipShellClass, /border/);
  });
});
