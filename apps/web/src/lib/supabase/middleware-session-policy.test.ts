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

  it('bypasses customer public APIs only', () => {
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/customer/session'),
      true,
    );
    assert.equal(
      shouldBypassMiddlewareSession('/api/restaurants/r1/staff/waiter/board'),
      false,
    );
  });

  it('keeps dashboard and auth on the session path', () => {
    assert.equal(shouldBypassMiddlewareSession('/dashboard/waiter'), false);
    assert.equal(shouldBypassMiddlewareSession('/auth/login'), false);
  });
});

describe('buildMiddlewareMatcher', () => {
  it('embeds every bypass prefix and derived customer alt', () => {
    const [matcher] = buildMiddlewareMatcher();
    assert.match(matcher, /api\/print-agent/);
    assert.match(matcher, /api\/cron/);
    assert.match(matcher, /api\/health/);
    assert.match(matcher, /api\/downloads/);
    assert.match(matcher, /api\/restaurants\/\[\^\/\]\+\/customer/);
  });
});

describe('pathnameBypassSourceToMatcherAlt', () => {
  it('strips leading slash anchor for matcher capture group', () => {
    assert.equal(
      pathnameBypassSourceToMatcherAlt('^/api/restaurants/[^/]+/customer(?:/|$)'),
      'api/restaurants/[^/]+/customer(?:/.*)?',
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
