import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isOperationLogsHostEnabled } from './access';

describe('isOperationLogsHostEnabled', () => {
  const prev = process.env.MESA_ON_PREM;

  afterEach(() => {
    if (prev === undefined) delete process.env.MESA_ON_PREM;
    else process.env.MESA_ON_PREM = prev;
  });

  it('is true only when MESA_ON_PREM is set', () => {
    process.env.MESA_ON_PREM = '1';
    assert.equal(isOperationLogsHostEnabled(), true);
    delete process.env.MESA_ON_PREM;
    assert.equal(isOperationLogsHostEnabled(), false);
  });
});
