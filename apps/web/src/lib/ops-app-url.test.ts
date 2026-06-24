import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getOpsAppUrl } from './ops-app-url';

describe('getOpsAppUrl', () => {
  const original = process.env.NEXT_PUBLIC_OPS_APP_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  it('returns trimmed env URL when set', () => {
    process.env.NEXT_PUBLIC_OPS_APP_URL = 'https://ops.example.com/';
    assert.equal(getOpsAppUrl(), 'https://ops.example.com');
    process.env.NEXT_PUBLIC_OPS_APP_URL = original;
  });

  it('returns localhost ops in development when env unset', () => {
    delete process.env.NEXT_PUBLIC_OPS_APP_URL;
    process.env.NODE_ENV = 'development';
    assert.equal(getOpsAppUrl(), 'http://localhost:3001');
    process.env.NODE_ENV = originalNodeEnv;
    if (original !== undefined) process.env.NEXT_PUBLIC_OPS_APP_URL = original;
  });
});
