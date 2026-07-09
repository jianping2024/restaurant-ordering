import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  customerOrderingIntroStorageKey,
  shouldShowCustomerOrderingIntro,
} from './customer-ordering-intro-preference';

describe('customerOrderingIntroStorageKey', () => {
  it('scopes seen flag per restaurant slug', () => {
    assert.equal(
      customerOrderingIntroStorageKey('casa-lusa'),
      'mesa-customer-intro-seen:casa-lusa',
    );
  });
});

describe('shouldShowCustomerOrderingIntro', () => {
  it('shows for guest when session is resolved and intro not seen', () => {
    assert.equal(
      shouldShowCustomerOrderingIntro({
        audience: 'guest',
        sessionResolved: true,
        hasSeenIntro: false,
      }),
      true,
    );
  });

  it('hides for staff-assisted ordering', () => {
    assert.equal(
      shouldShowCustomerOrderingIntro({
        audience: 'staff-assisted',
        sessionResolved: true,
        hasSeenIntro: false,
      }),
      false,
    );
  });

  it('hides until session context is resolved', () => {
    assert.equal(
      shouldShowCustomerOrderingIntro({
        audience: 'guest',
        sessionResolved: false,
        hasSeenIntro: false,
      }),
      false,
    );
  });

  it('hides after intro was seen for this restaurant', () => {
    assert.equal(
      shouldShowCustomerOrderingIntro({
        audience: 'guest',
        sessionResolved: true,
        hasSeenIntro: true,
      }),
      false,
    );
  });
});
