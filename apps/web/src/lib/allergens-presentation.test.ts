import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  resolveMenuItemAllergenPresentation,
} from '@/lib/allergens';

describe('resolveMenuItemAllergenPresentation', () => {
  it('marks empty as unmarked', () => {
    assert.deepEqual(resolveMenuItemAllergenPresentation([], 'zh'), { status: 'unmarked' });
    assert.deepEqual(resolveMenuItemAllergenPresentation(undefined, 'en'), {
      status: 'unmarked',
    });
  });

  it('returns labeled chips for valid codes', () => {
    const view = resolveMenuItemAllergenPresentation(['fish', 'gluten'], 'zh');
    assert.equal(view.status, 'marked');
    if (view.status !== 'marked') return;
    assert.deepEqual(
      view.items.map((i) => i.label),
      ['鱼', '麸质'],
    );
  });

  it('treats invalid codes as unmarked', () => {
    assert.deepEqual(resolveMenuItemAllergenPresentation(['shellfish'], 'en'), {
      status: 'unmarked',
    });
  });
});
