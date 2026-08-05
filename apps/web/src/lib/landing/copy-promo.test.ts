import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUPPORTED_UI_LANGS, UI_LANGUAGE_PICKER_OPTIONS } from '../i18n';
import { getLandingCopy } from './copy';

const PILLAR_IDS = ['economy', 'security', 'stability', 'convenience'] as const;

describe('landing copy promo alignment', () => {
  it('exposes all six languages with exactly four pillar ids', () => {
    assert.deepEqual(
      SUPPORTED_UI_LANGS,
      ['zh', 'en', 'pt', 'es', 'fr', 'de'],
    );
    for (const lang of SUPPORTED_UI_LANGS) {
      const copy = getLandingCopy(lang);
      assert.deepEqual(
        copy.pillars.items.map((p) => p.id),
        [...PILLAR_IDS],
      );
      assert.ok(copy.hero.agentCta.length > 0);
      assert.ok(copy.contact.agent.title.length > 0);
      assert.equal(copy.pain.items.length, 3);
      assert.equal(copy.buffet.items.length, 4);
    }
  });

  it('hides es/fr/de from the language picker catalog', () => {
    assert.deepEqual(
      UI_LANGUAGE_PICKER_OPTIONS.map((o) => o.id),
      ['zh', 'en', 'pt'],
    );
  });
});
