import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CUSTOMER_MENU_TABLE_GUESTS_CHROME_CLASS,
  CUSTOMER_MENU_TABLE_GUESTS_LABEL_CLASS,
  formatCustomerMenuTableGuestsLabel,
} from './customer-menu-table-guests';

describe('formatCustomerMenuTableGuestsLabel', () => {
  it('formats zh with floored non-negative count', () => {
    assert.equal(formatCustomerMenuTableGuestsLabel(0, 'zh'), '本桌 0 人');
    assert.equal(formatCustomerMenuTableGuestsLabel(4, 'zh'), '本桌 4 人');
    assert.equal(formatCustomerMenuTableGuestsLabel(4.9, 'zh'), '本桌 4 人');
    assert.equal(formatCustomerMenuTableGuestsLabel(-2, 'zh'), '本桌 0 人');
  });

  it('formats en without leftover placeholders', () => {
    const s = formatCustomerMenuTableGuestsLabel(3, 'en');
    assert.equal(s, '3 guests');
    assert.doesNotMatch(s, /\{guests\}/);
  });
});

describe('customer menu table guests chrome tokens', () => {
  it('keeps sole label + chrome class names', () => {
    assert.match(CUSTOMER_MENU_TABLE_GUESTS_LABEL_CLASS, /text-\[13px\]/);
    assert.match(CUSTOMER_MENU_TABLE_GUESTS_CHROME_CLASS, /border-b/);
  });
});
