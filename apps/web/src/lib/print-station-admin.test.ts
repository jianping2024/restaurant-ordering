import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatPrintStationAltNamesLine,
  formatPrintStationMenuBindings,
  printStationAltNameParts,
} from './print-station-admin';

describe('formatPrintStationMenuBindings', () => {
  const template = '菜单：{categories} 个分类 · {dishes} 道菜';

  it('formats zero counts with the same template', () => {
    assert.equal(formatPrintStationMenuBindings(0, 0, template), '菜单：0 个分类 · 0 道菜');
  });

  it('formats non-zero counts with the same template', () => {
    assert.equal(formatPrintStationMenuBindings(10, 2, template), '菜单：10 个分类 · 2 道菜');
  });
});

describe('printStationAltNameParts + formatPrintStationAltNamesLine', () => {
  it('omits EN/PT when they match the title', () => {
    const parts = printStationAltNameParts(
      { name_en: 'Bar', name_pt: 'Bar' },
      'Bar',
      '未填',
    );
    assert.deepEqual(parts, []);
    assert.equal(formatPrintStationAltNamesLine(parts), '');
  });

  it('shows missing label for empty EN/PT', () => {
    const parts = printStationAltNameParts(
      { name_en: null, name_pt: '' },
      '后厨',
      '未填',
    );
    assert.equal(formatPrintStationAltNamesLine(parts), 'EN 未填 · PT 未填');
  });

  it('shows differing EN/PT only', () => {
    const parts = printStationAltNameParts(
      { name_en: 'checkout-1', name_pt: 'caixa-1' },
      '收银台-1',
      '未填',
    );
    assert.equal(formatPrintStationAltNamesLine(parts), 'EN checkout-1 · PT caixa-1');
  });

  it('omits PT when title is the PT name', () => {
    const parts = printStationAltNameParts(
      { name_en: 'Kitchen', name_pt: 'Cozinha' },
      'Cozinha',
      'Em falta',
    );
    assert.equal(formatPrintStationAltNamesLine(parts), 'EN Kitchen');
  });
});
