import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { messageForCustomerGeoFailure } from './customer-geo-menu-access';

describe('messageForCustomerGeoFailure', () => {
  it('uses the locked too-far guest line in zh', () => {
    assert.equal(messageForCustomerGeoFailure('zh', 'too_far'), '请到店后再点餐');
  });

  it('maps each geo failure to a distinct guest line', () => {
    assert.match(messageForCustomerGeoFailure('zh', 'permission_denied'), /定位/);
    assert.match(messageForCustomerGeoFailure('zh', 'not_supported'), /不支持定位/);
    assert.match(messageForCustomerGeoFailure('zh', 'check_failed'), /刷新/);
  });
});
