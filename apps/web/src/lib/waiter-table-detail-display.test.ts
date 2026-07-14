import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatWaiterTableDetailHeading } from '@/lib/waiter-table-detail-display';

describe('formatWaiterTableDetailHeading', () => {
  it('joins details title and display_name without a table prefix (zh)', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', '002'), '桌台详情 · 002');
  });

  it('joins details title and display_name without a table prefix (en)', () => {
    assert.equal(formatWaiterTableDetailHeading('en', '002'), 'Table details · 002');
  });

  it('joins details title and display_name without a table prefix (pt)', () => {
    assert.equal(formatWaiterTableDetailHeading('pt', '002'), 'Detalhes da mesa · 002');
  });

  it('passes through custom display names unchanged', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', 'VIP-A'), '桌台详情 · VIP-A');
  });

  it('supports loading placeholder', () => {
    assert.equal(formatWaiterTableDetailHeading('zh', '…'), '桌台详情 · …');
  });
});
