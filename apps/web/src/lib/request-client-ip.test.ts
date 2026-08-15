import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clientIpFromRequest } from './request-client-ip';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/auth/login', { headers });
}

describe('clientIpFromRequest', () => {
  it('prefers CF-Connecting-IP over spoofed leftmost X-Forwarded-For', () => {
    assert.equal(
      clientIpFromRequest(
        req({
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.1, 10.0.0.2',
          'x-real-ip': '198.51.100.9',
        }),
      ),
      '203.0.113.10',
    );
  });

  it('uses rightmost X-Forwarded-For when CF header is absent (proxy-appended peer)', () => {
    assert.equal(
      clientIpFromRequest(req({ 'x-forwarded-for': '198.51.100.1, 192.168.1.50' })),
      '192.168.1.50',
    );
  });

  it('does not treat a single spoofable XFF hop as more trusted than X-Real-IP fallback chain', () => {
    assert.equal(
      clientIpFromRequest(req({ 'x-forwarded-for': '198.51.100.1' })),
      '198.51.100.1',
    );
    assert.equal(
      clientIpFromRequest(req({ 'x-real-ip': '192.168.1.20' })),
      '192.168.1.20',
    );
  });

  it('returns unknown when no usable header', () => {
    assert.equal(clientIpFromRequest(req({})), 'unknown');
    assert.equal(clientIpFromRequest(req({ 'x-forwarded-for': 'not-an-ip' })), 'unknown');
  });

  it('normalizes bracketed IPv6 from CF-Connecting-IP', () => {
    assert.equal(
      clientIpFromRequest(req({ 'cf-connecting-ip': '[2001:db8::1]' })),
      '2001:db8::1',
    );
  });
});
