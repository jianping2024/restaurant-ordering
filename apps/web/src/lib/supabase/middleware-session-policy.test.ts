import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildMiddlewareMatcher,
  isInvalidRefreshTokenError,
  pathnameBypassSourceToMatcherAlt,
  shouldBypassMiddlewareSession,
} from '@/lib/supabase/middleware-session-policy';

describe('shouldBypassMiddlewareSession', () => {
  it('bypasses print-agent, cron, health, downloads', () => {
    assert.equal(shouldBypassMiddlewareSession('/api/print-agent/pending-jobs'), true);
    assert.equal(shouldBypassMiddlewareSession('/api/cron/nightly-close-sessions'), true);
    assert.equal(shouldBypassMiddlewareSession('/api/health'), true);
    assert.equal(shouldBypassMiddlewareSession('/api/downloads/print-agent/foo'), true);
  });

  it('bypasses restaurant customer and staff APIs that auth in-route', () => {
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/customer/session'),
      true,
    );
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/staff/waiter/board'),
      true,
    );
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/staff/kitchen/board'),
      true,
    );
    // Checkout / orders still refresh session in middleware (not under customer|staff).
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/checkout/requests'),
      false,
    );
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/orders/append'),
      false,
    );
  });

  it('keeps dashboard and auth on the session path', () => {
    assert.equal(shouldBypassMiddlewareSession('/dashboard/waiter'), false);
    assert.equal(shouldBypassMiddlewareSession('/auth/login'), false);
  });
});

describe('buildMiddlewareMatcher', () => {
  it('embeds every bypass prefix and the sole customer|staff restaurant alt', () => {
    const [matcher] = buildMiddlewareMatcher();
    assert.match(matcher, /api\/print-agent/);
    assert.match(matcher, /api\/cron/);
    assert.match(matcher, /api\/health/);
    assert.match(matcher, /api\/downloads/);
    assert.match(
      matcher,
      /api\/restaurants\/\[\^\/\]\+\/\(\?:customer\|staff\)/,
    );
    // One representation — not parallel customer-only + staff-only alts.
    assert.equal(
      (matcher.match(/api\/restaurants\/\[\^\/\]\+\/\(\?:customer\|staff\)/g) ?? []).length,
      1,
    );
  });
});

describe('pathnameBypassSourceToMatcherAlt', () => {
  it('strips leading slash anchor for matcher capture group', () => {
    assert.equal(
      pathnameBypassSourceToMatcherAlt(
        '^/api/restaurants/[^/]+/(?:customer|staff)(?:/|$)',
      ),
      'api/restaurants/[^/]+/(?:customer|staff)(?:/.*)?',
    );
  });
});

describe('isInvalidRefreshTokenError', () => {
  it('detects refresh_token_not_found and message variants', () => {
    assert.equal(isInvalidRefreshTokenError({ code: 'refresh_token_not_found' }), true);
    assert.equal(
      isInvalidRefreshTokenError({ message: 'Invalid Refresh Token: Refresh Token Not Found' }),
      true,
    );
    assert.equal(isInvalidRefreshTokenError({ code: 'other', message: 'nope' }), false);
  });
});
