import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LANDING_CASE_VENUE,
  LANDING_CASE_VENUE_MAPS_URL,
  LANDING_CASE_VENUE_TEL_HREF,
} from './case-venue';
import { getLandingCopy } from './copy';
import { SUPPORTED_UI_LANGS, UI_LANGUAGE_PICKER_OPTIONS } from '../i18n';

describe('landing copy promo alignment', () => {
  it('exposes all six languages with sole pain→buffet shape (no pillars)', () => {
    assert.deepEqual(
      SUPPORTED_UI_LANGS,
      ['zh', 'en', 'pt', 'es', 'fr', 'de'],
    );
    for (const lang of SUPPORTED_UI_LANGS) {
      const copy = getLandingCopy(lang);
      assert.ok(!('pillars' in copy));
      assert.ok(!('preview' in copy));
      assert.ok(!('preview' in copy.nav));
      assert.ok(copy.hero.agentCta.length > 0);
      assert.ok(copy.hero.agentLead.length > 0);
      assert.equal(copy.hero.proofs.length, 3);
      assert.ok(copy.contact.agent.title.length > 0);
      assert.equal(copy.pain.items.length, 3);
      assert.ok(copy.caseStudy.title.length > 0);
      assert.ok(copy.caseStudy.hours.length > 0);
      assert.ok(!('name' in copy.caseStudy));
      assert.ok(!('quote' in copy.caseStudy));
      assert.ok(!('tags' in copy.caseStudy));
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

describe('landing case venue (sole facts)', () => {
  it('exposes one Pirata address/phone and Maps/tel hrefs', () => {
    assert.equal(LANDING_CASE_VENUE.name, 'Pirata Restaurant');
    assert.equal(
      LANDING_CASE_VENUE.address,
      'Sentido Torres Vedras 9, 2560-250 Torres Vedras',
    );
    assert.equal(LANDING_CASE_VENUE.phoneDisplay, '261 244 930');
    assert.equal(LANDING_CASE_VENUE.phoneTel, '+351261244930');
    assert.match(LANDING_CASE_VENUE_MAPS_URL, /^https:\/\/www\.google\.com\/maps\/search\/\?/);
    assert.ok(LANDING_CASE_VENUE_MAPS_URL.includes(encodeURIComponent(LANDING_CASE_VENUE.address)));
    assert.equal(LANDING_CASE_VENUE_TEL_HREF, 'tel:+351261244930');
  });
});
