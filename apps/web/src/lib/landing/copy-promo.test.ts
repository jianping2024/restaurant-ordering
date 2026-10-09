import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  LANDING_CASE_VENUE,
  LANDING_CASE_VENUE_MAPS_URL,
  LANDING_CASE_VENUE_TEL_HREF,
} from './case-venue';
import { getLandingCopy } from './copy';
import {
  LANDING_CONTACT_PEOPLE,
  LANDING_WECHAT_CONTACTS,
  LANDING_WHATSAPP_CONTACTS,
  LANDING_WHATSAPP_URL,
} from './contact';
import { SUPPORTED_UI_LANGS, UI_LANGUAGE_PICKER_OPTIONS } from '../i18n';

describe('landing copy promo alignment', () => {
  it('authors zh/en/pt and serves es/fr/de the English copy', () => {
    assert.deepEqual(
      SUPPORTED_UI_LANGS,
      ['zh', 'en', 'pt', 'es', 'fr', 'de'],
    );
    for (const lang of ['es', 'fr', 'de'] as const) {
      assert.equal(getLandingCopy(lang), getLandingCopy('en'));
    }
    for (const lang of SUPPORTED_UI_LANGS) {
      const copy = getLandingCopy(lang);
      assert.ok(!('pillars' in copy));
      assert.ok(!('buffet' in copy));
      assert.ok(!('support' in copy));
      assert.ok(copy.hero.agentCta.length > 0);
      assert.ok(copy.hero.agentLead.length > 0);
      assert.equal(copy.hero.proofs.length, 3);
      assert.ok(copy.contact.agent.title.length > 0);
      assert.equal(copy.strip.length, 4);
      assert.equal(copy.pain.items.length, 5);
      assert.equal(copy.flow.steps.length, 4);
      assert.equal(copy.team.founders.length, 2);
      assert.equal(copy.caseStudy.results.length, 4);
      assert.equal(copy.contact.steps.length, 4);
      assert.ok(copy.caseStudy.hours.length > 0);
      for (const item of copy.pain.items) {
        assert.ok(item.title.length > 0);
        assert.ok(item.problem.length > 0);
        assert.ok(item.solution.length > 0);
      }
      // Sales contact is sole 李先生; team intro may list more founders.
      assert.equal(LANDING_CONTACT_PEOPLE.length, 1);
      assert.equal(LANDING_CONTACT_PEOPLE[0]!.key, 'li');
      assert.ok(LANDING_CONTACT_PEOPLE[0]!.founderIndex < copy.team.founders.length);
    }
  });

  it('keeps the language picker on three languages', () => {
    assert.deepEqual(
      UI_LANGUAGE_PICKER_OPTIONS.map((o) => o.id),
      ['zh', 'en', 'pt'],
    );
  });
});

describe('landing contact people (sole sales contact)', () => {
  it('keeps only 李先生 and derives flat renew/Pro lists from that one person', () => {
    const [li] = LANDING_CONTACT_PEOPLE;
    assert.equal(li.key, 'li');
    assert.equal(li.founderIndex, 0);
    assert.equal(li.whatsapp.waUrl, 'https://wa.me/351925736572');
    assert.equal(li.wechat.display, '强');
    assert.deepEqual(
      LANDING_WHATSAPP_CONTACTS.map((c) => c.waUrl),
      [li.whatsapp.waUrl],
    );
    assert.deepEqual(
      LANDING_WECHAT_CONTACTS.map((c) => c.key),
      [li.wechat.key],
    );
    assert.equal(LANDING_WHATSAPP_URL, li.whatsapp.waUrl);
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
