import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  fitStaffTopBarRestaurantName,
  STAFF_TOPBAR_NAME_ELLIPSIS,
} from '@/lib/staff-topbar-restaurant-name';

/** Rough width: 10px per character (CJK and Latin same for deterministic tests). */
function measure(text: string): number {
  return text.length * 10;
}

describe('fitStaffTopBarRestaurantName', () => {
  it('keeps full name when it fits', () => {
    const fit = fitStaffTopBarRestaurantName('Washoku Sushi', 200, measure);
    assert.equal(fit.display, 'Washoku Sushi');
    assert.equal(fit.mode, 'full');
    assert.equal(fit.keptWordCount, 2);
  });

  it('drops words from the right until the leading phrase fits', () => {
    // "Washoku Sushi Bar" = 17 chars → 170; drop Bar → "Washoku Sushi" = 13 → 130
    const fit = fitStaffTopBarRestaurantName('Washoku Sushi Bar', 140, measure);
    assert.equal(fit.display, 'Washoku Sushi');
    assert.equal(fit.mode, 'drop-words');
    assert.equal(fit.keptWordCount, 2);
  });

  it('drops down to a single word when needed', () => {
    const fit = fitStaffTopBarRestaurantName('Washoku Sushi Bar', 80, measure);
    assert.equal(fit.display, 'Washoku');
    assert.equal(fit.mode, 'drop-words');
    assert.equal(fit.keptWordCount, 1);
  });

  it('ellipsizes the last remaining word when still too wide', () => {
    // "Washoku" = 7 → 70; budget 45 → prefix + ellipsis
    const fit = fitStaffTopBarRestaurantName('Washoku Sushi', 45, measure);
    assert.equal(fit.mode, 'ellipsis');
    assert.equal(fit.display, `Was${STAFF_TOPBAR_NAME_ELLIPSIS}`);
    assert.equal(fit.keptWordCount, 1);
  });

  it('treats Chinese (no spaces) as one word and ellipsizes', () => {
    const fit = fitStaffTopBarRestaurantName('白云自助火锅店总店', 50, measure);
    assert.equal(fit.mode, 'ellipsis');
    assert.ok(fit.display.endsWith(STAFF_TOPBAR_NAME_ELLIPSIS));
    assert.equal(fit.keptWordCount, 1);
  });

  it('collapses internal whitespace before fitting', () => {
    const fit = fitStaffTopBarRestaurantName('  Washoku   Sushi  ', 200, measure);
    assert.equal(fit.display, 'Washoku Sushi');
    assert.equal(fit.mode, 'full');
  });
});
