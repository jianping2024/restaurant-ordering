import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyWaiterBoardFetchFailure,
  initialWaiterBoardSurface,
  staffBoardFetchError,
  surfaceAfterRefreshFailure,
  surfaceAfterRefreshSuccess,
  surfaceForRefreshStart,
  waiterBoardFloorReady,
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
    assert.equal(classifyWaiterBoardFetchFailure(staffBoardFetchError(401)), 'unauthorized');
    assert.equal(classifyWaiterBoardFetchFailure(staffBoardFetchError(403)), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure(staffBoardFetchError(500)), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure(staffBoardFetchError(429)), 'failed');
    assert.equal(classifyWaiterBoardFetchFailure(new Error('network')), 'failed');
  });

  it('keeps ready on soft sync failure; cold path fails', () => {
    assert.equal(surfaceAfterRefreshFailure('ready', 'failed'), 'ready');
    assert.equal(surfaceAfterRefreshFailure('loading', 'failed'), 'failed');
    assert.equal(surfaceAfterRefreshFailure('failed', 'failed'), 'failed');
    assert.equal(surfaceAfterRefreshFailure('loading', 'unauthorized'), 'auth-exit');
  });

  it('waiterBoardFloorReady is true only for ready', () => {
    assert.equal(waiterBoardFloorReady('ready'), true);
    assert.equal(waiterBoardFloorReady('loading'), false);
    assert.equal(waiterBoardFloorReady('failed'), false);
  });
});
