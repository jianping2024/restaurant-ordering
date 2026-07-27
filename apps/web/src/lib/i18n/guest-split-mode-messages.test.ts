import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GUEST_SPLIT_GUIDANCE,
  GUEST_SPLIT_MODE_ORDER,
  getGuestSplitGuidance,
  guestSplitModeLabels,
} from './guest-split-mode-messages';

describe('guest split mode guidance', () => {
  for (const lang of ['zh', 'en', 'pt'] as const) {
    it(`${lang}: has all modes, intro step, and preview demo`, () => {
      const g = getGuestSplitGuidance(lang);
      for (const mode of GUEST_SPLIT_MODE_ORDER) {
        assert.ok(g.modes[mode].label.trim());
        assert.ok(g.modes[mode].when.trim());
      }
      assert.ok(g.optionalHint.trim());
      assert.ok(g.introStep.title.trim());
      assert.ok(g.introStep.body.trim());
      assert.equal(g.introPreview.lines.length, 2);
      assert.equal(g.introPreview.people.length, 2);
    });
  }

  it('guestSplitModeLabels matches catalog labels', () => {
    const labels = guestSplitModeLabels('pt');
    const modes = GUEST_SPLIT_GUIDANCE.pt.modes;
    assert.equal(labels.even, modes.even.label);
    assert.equal(labels.byItem, modes.by_item.label);
    assert.equal(labels.custom, modes.custom.label);
  });

  it('pt recommends Por prato wording (not Por consumo / Manual)', () => {
    const { modes, optionalHint } = GUEST_SPLIT_GUIDANCE.pt;
    assert.equal(modes.by_item.label, 'Por prato');
    assert.equal(modes.custom.label, 'Valores');
    assert.match(optionalHint, /Quer dividir/i);
    assert.doesNotMatch(optionalHint, /diretamente ou escolher/i);
  });
});
