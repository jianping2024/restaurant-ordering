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
      // Advisor tabs are named by the team copy, one entry per contact person.
      assert.equal(copy.team.founders.length, LANDING_CONTACT_PEOPLE.length);
    }
  });

  it('keeps the language picker on three languages', () => {
    assert.deepEqual(
      UI_LANGUAGE_PICKER_OPTIONS.map((o) => o.id),
      ['zh', 'en', 'pt'],
    );
  });
});

describe('landing contact people (sole sales contacts)', () => {
  it('pairs each advisor WhatsApp with their own WeChat and derives the flat lists', () => {
    const [li, chen] = LANDING_CONTACT_PEOPLE;
    assert.equal(li.whatsapp.waUrl, 'https://wa.me/351925736572');
    assert.equal(li.wechat.display, '强');
    assert.equal(chen.whatsapp.waUrl, 'https://wa.me/351911092527');
    assert.equal(chen.wechat.id, 'p9110925');
    assert.deepEqual(
      LANDING_WHATSAPP_CONTACTS.map((c) => c.waUrl),
      [chen.whatsapp.waUrl, li.whatsapp.waUrl],
    );
    assert.deepEqual(
      LANDING_WECHAT_CONTACTS.map((c) => c.key),
      [chen.wechat.key, li.wechat.key],
    );
    assert.equal(LANDING_WHATSAPP_URL, chen.whatsapp.waUrl);
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
