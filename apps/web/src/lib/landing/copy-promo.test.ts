import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPPORTED_UI_LANGS, UI_LANGUAGE_PICKER_OPTIONS } from '../i18n';
import { getLandingCopy } from './copy';

describe('landing copy promo alignment', () => {
  it('exposes all six languages with sole pain→buffet shape (no pillars)', () => {
    assert.deepEqual(
      SUPPORTED_UI_LANGS,
      ['zh', 'en', 'pt', 'es', 'fr', 'de'],
    );
    for (const lang of SUPPORTED_UI_LANGS) {
      const copy = getLandingCopy(lang);
      assert.ok(!('pillars' in copy));
      assert.ok(copy.hero.agentCta.length > 0);
      assert.ok(copy.hero.agentLead.length > 0);
      assert.equal(copy.hero.proofs.length, 3);
      assert.ok(copy.contact.agent.title.length > 0);
      assert.equal(copy.pain.items.length, 3);
      for (const item of copy.pain.items) {
        assert.ok(item.title.length > 0);
        assert.ok(item.problem.length > 0);
        assert.ok(item.solution.length > 0);
      }
      // Ops scenes only — traceability lives in pain, not a fourth buffet card.
      assert.equal(copy.buffet.items.length, 3);
    }
  });

  it('hides es/fr/de from the language picker catalog', () => {
    assert.deepEqual(
      UI_LANGUAGE_PICKER_OPTIONS.map((o) => o.id),
      ['zh', 'en', 'pt'],
    );
  });
});
