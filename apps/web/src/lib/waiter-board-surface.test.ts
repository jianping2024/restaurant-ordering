import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyWaiterBoardFetchFailure,
  initialWaiterBoardSurface,
  surfaceAfterRefreshFailure,
  surfaceAfterRefreshSuccess,
  surfaceForRefreshStart,
} from './waiter-board-surface';

describe('waiter-board-surface', () => {
  it('seeds ready only when floor static is present', () => {
    assert.equal(initialWaiterBoardSurface(true), 'ready');
    assert.equal(initialWaiterBoardSurface(false), 'loading');
  });

  it('retry from failed enters loading; ready stays ready', () => {
    assert.equal(surfaceForRefreshStart('failed'), 'loading');
    assert.equal(surfaceForRefreshStart('ready'), 'ready');
    assert.equal(surfaceForRefreshStart('loading'), 'loading');
  });

  it('only full success promotes to ready', () => {
    assert.equal(surfaceAfterRefreshSuccess('full', 'loading'), 'ready');
    assert.equal(surfaceAfterRefreshSuccess('full', 'failed'), 'ready');
    assert.equal(surfaceAfterRefreshSuccess('live', 'loading'), 'loading');
    assert.equal(surfaceAfterRefreshSuccess('live', 'ready'), 'ready');
  });

  it('maps only HTTP 401 as unauthorized; everything else as failed', () => {
    assert.equal(classifyWaiterBoardFetchFailure({ status: 401 }), 'unauthorized');
    assert.equal(classifyWaiterBoardFetchFailure({ status: 403 }), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure({ status: 500 }), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure({ status: 429 }), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure(new Error('network')), 'failed');
  });

  it('keeps ready on soft sync failure; cold path fails', () => {
    assert.equal(surfaceAfterRefreshFailure('ready', 'failed'), 'ready');
    assert.equal(surfaceAfterRefreshFailure('loading', 'failed'), 'failed');
    assert.equal(surfaceAfterRefreshFailure('failed', 'failed'), 'failed');
    assert.equal(surfaceAfterRefreshFailure('loading', 'unauthorized'), 'auth-exit');
  });
});
