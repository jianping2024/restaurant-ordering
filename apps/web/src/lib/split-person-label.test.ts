import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isWholeTablePayerName,
  LEGACY_WHOLE_TABLE_PAYER_LABEL,
  localizeSplitPersonName,
  uiLangFromPrintLocale,
  WHOLE_TABLE_PAYER_KEY,
  wholeTableLabelForLang,
} from './split-person-label';

describe('isWholeTablePayerName', () => {
  it('recognizes canonical key and legacy Chinese label', () => {
    assert.equal(isWholeTablePayerName(WHOLE_TABLE_PAYER_KEY), true);
    assert.equal(isWholeTablePayerName(LEGACY_WHOLE_TABLE_PAYER_LABEL), true);
    assert.equal(isWholeTablePayerName('Guest 1'), false);
  });
});

describe('localizeSplitPersonName', () => {
  it('maps whole-table markers to the active UI language', () => {
    assert.equal(localizeSplitPersonName(WHOLE_TABLE_PAYER_KEY, 'pt'), 'Mesa inteira');
    assert.equal(localizeSplitPersonName(LEGACY_WHOLE_TABLE_PAYER_LABEL, 'en'), 'Whole table');
    assert.equal(localizeSplitPersonName('Ana', 'pt'), 'Ana');
  });
});

describe('uiLangFromPrintLocale', () => {
  it('normalizes receipt print locales', () => {
    assert.equal(uiLangFromPrintLocale('pt-PT'), 'pt');
    assert.equal(uiLangFromPrintLocale('en-US'), 'en');
    assert.equal(uiLangFromPrintLocale('zh-CN'), 'zh');
    assert.equal(uiLangFromPrintLocale(null), 'pt');
  });
});

describe('wholeTableLabelForLang', () => {
  it('returns bill i18n labels', () => {
    assert.equal(wholeTableLabelForLang('zh'), '整桌');
  });
});
