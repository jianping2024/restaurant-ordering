import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isGeoOrderRestrictionActive,
  isGeoOrderRestrictionActiveForRestaurant,
  readGeoOrderRestrictionEnabled,
  resolveActiveGeoOrderCoords,
} from './geo-order-restriction';

describe('readGeoOrderRestrictionEnabled', () => {
  it('defaults to on when coordinates exist and flag is missing', () => {
    assert.equal(readGeoOrderRestrictionEnabled({}, true), true);
  });

  it('defaults to off when coordinates are missing and flag is missing', () => {
    assert.equal(readGeoOrderRestrictionEnabled({}, false), false);
  });

  it('respects explicit false', () => {
    assert.equal(readGeoOrderRestrictionEnabled({ geo_order_restriction: false }, true), false);
  });

  it('respects explicit true without coordinates', () => {
    assert.equal(readGeoOrderRestrictionEnabled({ geo_order_restriction: true }, false), true);
  });
});

describe('isGeoOrderRestrictionActive', () => {
  it('is inactive without coordinates', () => {
    assert.equal(
      isGeoOrderRestrictionActive({ geoLatitude: null, geoLongitude: 39, featureFlags: {} }),
      false,
    );
  });

  it('is active with coordinates and no explicit off flag', () => {
    assert.equal(
      isGeoOrderRestrictionActive({
        geoLatitude: 39.1,
        geoLongitude: -9.2,
        featureFlags: {},
      }),
      true,
    );
  });

  it('is inactive when flag is false', () => {
    assert.equal(
      isGeoOrderRestrictionActive({
        geoLatitude: 39.1,
        geoLongitude: -9.2,
        featureFlags: { geo_order_restriction: false },
      }),
      false,
    );
  });

  it('is inactive when flag is true but coordinates are missing', () => {
    assert.equal(
      isGeoOrderRestrictionActive({
        geoLatitude: null,
        geoLongitude: null,
        featureFlags: { geo_order_restriction: true },
      }),
      false,
    );
  });
});

describe('resolveActiveGeoOrderCoords', () => {
  it('returns anchor when restriction is active', () => {
    assert.deepEqual(
      resolveActiveGeoOrderCoords({
        geo_latitude: 39.1,
        geo_longitude: -9.2,
        feature_flags: {},
      }),
      { latitude: 39.1, longitude: -9.2 },
    );
  });

  it('returns null when restriction is off', () => {
    assert.equal(
      resolveActiveGeoOrderCoords({
        geo_latitude: 39.1,
        geo_longitude: -9.2,
        feature_flags: { geo_order_restriction: false },
      }),
      null,
    );
  });
});

describe('isGeoOrderRestrictionActiveForRestaurant', () => {
  it('delegates to restaurant fields', () => {
    assert.equal(
      isGeoOrderRestrictionActiveForRestaurant({
        geo_latitude: 1,
        geo_longitude: 2,
        feature_flags: { geo_order_restriction: false },
      }),
      false,
    );
  });
});
