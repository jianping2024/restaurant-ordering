import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPERATION_LOG_RETENTION_DAYS_DEFAULT,
  OPERATION_LOG_RETENTION_DAYS_MAX,
  OPERATION_LOG_RETENTION_DAYS_MIN,
  resolveOperationLogRetentionDays,
} from './retention-days';

describe('resolveOperationLogRetentionDays', () => {
  it('defaults invalid input to 7', () => {
    assert.equal(resolveOperationLogRetentionDays(undefined), OPERATION_LOG_RETENTION_DAYS_DEFAULT);
    assert.equal(resolveOperationLogRetentionDays('nope'), OPERATION_LOG_RETENTION_DAYS_DEFAULT);
  });

  it('clamps to 7-90', () => {
    assert.equal(resolveOperationLogRetentionDays(6), OPERATION_LOG_RETENTION_DAYS_MIN);
    assert.equal(resolveOperationLogRetentionDays(91), OPERATION_LOG_RETENTION_DAYS_MAX);
    assert.equal(resolveOperationLogRetentionDays(14.7), 15);
  });
});
