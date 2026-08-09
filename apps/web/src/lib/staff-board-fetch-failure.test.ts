import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyStaffBoardFetchFailure } from './staff-board-fetch-failure';

describe('classifyStaffBoardFetchFailure', () => {
  it('maps only HTTP 401 as unauthorized; everything else as failed', () => {
    assert.equal(classifyStaffBoardFetchFailure({ status: 401 }), 'unauthorized');
    assert.equal(classifyStaffBoardFetchFailure({ status: 403 }), 'failed');
    assert.equal(classifyStaffBoardFetchFailure({ status: 500 }), 'failed');
    assert.equal(classifyStaffBoardFetchFailure({ status: 429 }), 'failed');
    assert.equal(classifyStaffBoardFetchFailure(new Error('network')), 'failed');
  });
});
