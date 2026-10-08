import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { logCheckoutResumeFailure } from './checkout-resume-failure-log';

describe('logCheckoutResumeFailure', () => {
  it('emits sole [checkout_resume] resume_failed line', () => {
    const lines: unknown[][] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      logCheckoutResumeFailure({
        stage: 'api',
        error: 'no_session',
        status: 404,
        slug: 'pirata',
        table_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
    } finally {
      console.info = original;
    }

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.[0], '[checkout_resume]');
    assert.deepEqual(JSON.parse(String(lines[0]?.[1])), {
      event: 'resume_failed',
      stage: 'api',
      error: 'no_session',
      status: 404,
      slug: 'pirata',
      table_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });
});
