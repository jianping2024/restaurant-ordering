import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { logJsonConsoleEvent } from './json-console-log';

describe('logJsonConsoleEvent', () => {
  it('emits one [channel] JSON line and drops nullish fields', () => {
    const lines: unknown[][] = [];
    const original = console.info;
    console.info = (...args: unknown[]) => {
      lines.push(args);
    };
    try {
      logJsonConsoleEvent('waiter_buffet', 'open_failed', {
        status: 400,
        error: 'invalid_body',
        code: undefined,
        message: null,
        table_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
    } finally {
      console.info = original;
    }

    assert.equal(lines.length, 1);
    assert.equal(lines[0]?.[0], '[waiter_buffet]');
    assert.deepEqual(JSON.parse(String(lines[0]?.[1])), {
      event: 'open_failed',
      status: 400,
      error: 'invalid_body',
      table_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
  });
});
