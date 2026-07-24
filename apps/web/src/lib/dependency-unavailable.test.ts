import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyFailure,
  isDependencyUnavailableCode,
  messageLooksLikeDependencyFailure,
} from './dependency-unavailable';

describe('dependency-unavailable', () => {
  it('recognizes the stable code', () => {
    assert.equal(isDependencyUnavailableCode(DEPENDENCY_UNAVAILABLE), true);
    assert.equal(isDependencyUnavailableCode('invalid_credentials'), false);
  });

  it('classifies AbortError and fetch TypeError', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    assert.equal(isDependencyFailure(abort), true);

    const fetchFail = new TypeError('fetch failed');
    assert.equal(isDependencyFailure(fetchFail), true);
  });

  it('classifies Cloudflare 525 / HTML gateway bodies', () => {
    assert.equal(messageLooksLikeDependencyFailure('SSL handshake failed Error code 525'), true);
    assert.equal(
      messageLooksLikeDependencyFailure(
        '<!DOCTYPE html><title>supabase.co | 525: SSL handshake failed</title>',
      ),
      true,
    );
    assert.equal(messageLooksLikeDependencyFailure('Failed to get project config'), true);
  });

  it('does not treat credential errors as dependency failures', () => {
    assert.equal(isDependencyFailure(new Error('Invalid login credentials')), false);
    assert.equal(messageLooksLikeDependencyFailure('invalid_credentials'), false);
  });
});
