import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DASHBOARD_METRIC_TYPE } from './dashboard-metric-type';

describe('DASHBOARD_METRIC_TYPE', () => {
  it('keeps money on mesa-money token and figures on body tabular face', () => {
    assert.equal(DASHBOARD_METRIC_TYPE.money, 'mesa-money');
    assert.match(DASHBOARD_METRIC_TYPE.figure, /font-semibold/);
    assert.match(DASHBOARD_METRIC_TYPE.figure, /tabular-nums/);
    assert.doesNotMatch(DASHBOARD_METRIC_TYPE.money, /font-heading/);
    assert.doesNotMatch(DASHBOARD_METRIC_TYPE.figure, /font-heading|mesa-money/);
  });
});
