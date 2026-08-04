import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  REALTIME_RECONNECT_BASE_MS,
  REALTIME_RECONNECT_MAX_MS,
  isRealtimeSubscribeHardFailure,
  realtimeChannelTopic,
  realtimeReconnectDelayMs,
} from './use-restaurant-realtime-refresh.ts';

describe('isRealtimeSubscribeHardFailure', () => {
  it('treats only CHANNEL_ERROR and TIMED_OUT as hard failures', () => {
    assert.equal(isRealtimeSubscribeHardFailure('SUBSCRIBED'), false);
    assert.equal(isRealtimeSubscribeHardFailure('CHANNEL_ERROR'), true);
    assert.equal(isRealtimeSubscribeHardFailure('TIMED_OUT'), true);
    assert.equal(isRealtimeSubscribeHardFailure('CLOSED'), false);
    assert.equal(isRealtimeSubscribeHardFailure('JOINED'), false);
  });
});

describe('realtimeReconnectDelayMs', () => {
  it('uses exponential backoff and caps at max', () => {
    assert.equal(realtimeReconnectDelayMs(0), REALTIME_RECONNECT_BASE_MS);
    assert.equal(realtimeReconnectDelayMs(1), REALTIME_RECONNECT_BASE_MS * 2);
    assert.equal(realtimeReconnectDelayMs(2), REALTIME_RECONNECT_BASE_MS * 4);
    assert.equal(realtimeReconnectDelayMs(3), REALTIME_RECONNECT_BASE_MS * 8);
    assert.equal(realtimeReconnectDelayMs(4), REALTIME_RECONNECT_MAX_MS);
    assert.equal(realtimeReconnectDelayMs(8), REALTIME_RECONNECT_MAX_MS);
    assert.equal(realtimeReconnectDelayMs(-1), REALTIME_RECONNECT_BASE_MS);
  });
});

describe('realtimeChannelTopic', () => {
  it('keeps a stable key prefix and unique generation suffix', () => {
    assert.equal(realtimeChannelTopic('waiter-abc', 0), 'waiter-abc:0');
    assert.equal(realtimeChannelTopic('waiter-abc', 1), 'waiter-abc:1');
    assert.notEqual(realtimeChannelTopic('waiter-abc', 0), realtimeChannelTopic('waiter-abc', 1));
  });
});
